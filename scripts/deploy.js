#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { spawn } = require('child_process');

const chalk = require('chalk');

function stripAnsi(text) {
  // Minimal ANSI stripper for length calculations (only used for formatting).
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function hr(char = '─') {
  const width = Math.max(40, Math.min(100, (process.stdout.columns || 80) - 2));
  return char.repeat(width);
}

function title(text) {
  console.log(chalk.bold.cyan(text));
  console.log(chalk.dim(hr()));
}

function info(text) {
  console.log(chalk.cyan('ℹ') + ' ' + text);
}

function ok(text) {
  console.log(chalk.green('✔') + ' ' + text);
}

function warn(text) {
  console.log(chalk.yellow('⚠') + ' ' + text);
}

function err(text) {
  console.error(chalk.red('✖') + ' ' + text);
}

function commandExists(commandName) {
  const pathParts = (process.env.PATH || '').split(path.delimiter);
  const candidates = process.platform === 'win32'
    ? [commandName, `${commandName}.exe`, `${commandName}.cmd`, `${commandName}.bat`]
    : [commandName];

  for (const baseDir of pathParts) {
    for (const candidate of candidates) {
      const fullPath = path.join(baseDir, candidate);
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return true;
      } catch {
        // continue
      }
    }
  }
  return false;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function runCommandAllowFailure(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function runCommandCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...options,
    });

    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (d) => stdout.push(d));
    child.stderr.on('data', (d) => stderr.push(d));

    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function runCommandCaptureStreaming(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...options,
    });

    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (d) => {
      stdout.push(d);
      process.stdout.write(d);
    });

    child.stderr.on('data', (d) => {
      stderr.push(d);
      process.stderr.write(d);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

async function tryAdoptArtifactsBucket({ repoRoot, tfvarsPath, environment, region, bucketNameHint }) {
  let bucketName = (bucketNameHint || '').trim();

  if (!bucketName) {
    if (!commandExists('aws')) {
      warn('AWS CLI not found and bucket name was not detected from Terraform output; cannot auto-adopt S3 bucket.');
      return false;
    }

    const env = {
      ...process.env,
      AWS_REGION: region,
      AWS_DEFAULT_REGION: region,
      AWS_PAGER: '',
    };

    const whoami = await runCommandCapture('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], {
      cwd: repoRoot,
      env,
    });

    if (whoami.code !== 0) {
      warn('Could not determine AWS account ID to compute bucket name; skipping auto-adopt.');
      return false;
    }

    const accountId = whoami.stdout.trim();
    if (!accountId) return false;
    bucketName = `${environment}-ft-iac-artifacts-${accountId}-${region}`.toLowerCase().replace(/_/g, '-');
  }

  info(`Attempting to adopt existing S3 bucket into state: ${bucketName}`);

  const base = ['-chdir=terraform', 'import', `-var-file=${tfvarsPath}`];

  // Import the bucket and its associated configs (these are addressable by bucket name).
  await runCommandAllowFailure('terraform', [...base, 'aws_s3_bucket.artifacts[0]', bucketName], { cwd: repoRoot, env });
  await runCommandAllowFailure(
    'terraform',
    [...base, 'aws_s3_bucket_public_access_block.artifacts[0]', bucketName],
    { cwd: repoRoot, env },
  );
  await runCommandAllowFailure(
    'terraform',
    [...base, 'aws_s3_bucket_server_side_encryption_configuration.artifacts[0]', bucketName],
    { cwd: repoRoot, env },
  );

  ok('Artifacts bucket adopted (import attempted).');
  return true;
}

async function tryAdoptIamRoleAndProfile({ repoRoot, tfvarsPath, roleName, profileName, env }) {
  if (!roleName && !profileName) return false;

  let adopted = false;

  if (roleName) {
    info(`Attempting to adopt existing IAM role into state: ${roleName}`);
    const roleCode = await runCommandAllowFailure(
      'terraform',
      ['-chdir=terraform', 'import', `-var-file=${tfvarsPath}`, 'aws_iam_role.ssm_role', roleName],
      { cwd: repoRoot, env },
    );

    if (roleCode === 0) {
      ok('IAM role adopted into state (import succeeded).');
      adopted = true;
    } else {
      warn('IAM role import failed; continuing.');
    }
  }

  if (profileName) {
    info(`Attempting to adopt existing IAM instance profile into state: ${profileName}`);
    const profileCode = await runCommandAllowFailure(
      'terraform',
      ['-chdir=terraform', 'import', `-var-file=${tfvarsPath}`, 'aws_iam_instance_profile.ssm_profile', profileName],
      { cwd: repoRoot, env },
    );

    if (profileCode === 0) {
      ok('IAM instance profile adopted into state (import succeeded).');
      adopted = true;
    } else {
      warn('IAM instance profile import failed; continuing.');
    }
  }

  return adopted;
}

function extractConflictHints(terraformOutput) {
  const text = terraformOutput || '';

  const keyPairName = (text.match(/Key Pair \(([^)]+)\)/) || [])[1] || '';
  const bucketName = (text.match(/creating S3 Bucket \(([^)]+)\)/) || [])[1] || '';

  const roleName =
    (text.match(/Role with name ([^\s:]+) already exists/i) || [])[1]
    || (text.match(/creating IAM Role \(([^)]+)\)/i) || [])[1]
    || '';

  const profileName =
    (text.match(/Instance Profile with name ([^\s:]+) already exists/i) || [])[1]
    || (text.match(/Instance Profile ([^\s:]+) already exists/i) || [])[1]
    || (text.match(/creating IAM Instance Profile \(([^)]+)\)/i) || [])[1]
    || '';

  return {
    keyPairName,
    bucketName,
    roleName,
    profileName,
  };
}

async function tryAutoAdoptConflicts({
  combinedOutput,
  repoRoot,
  tfvarsPath,
  environment,
  region,
  sshKeyName,
  env,
}) {
  const hints = extractConflictHints(combinedOutput);
  let adoptedAny = false;

  if (combinedOutput.includes('InvalidKeyPair.Duplicate')) {
    warn('EC2 key pair already exists (likely created previously). Auto-adopting it into state...');
    const adopted = await tryAdoptEc2KeyPair({
      repoRoot,
      tfvarsPath,
      keyName: hints.keyPairName || sshKeyName,
      env,
    });
    adoptedAny = adoptedAny || adopted;
  }

  if (combinedOutput.includes('BucketAlreadyOwnedByYou')) {
    warn('S3 bucket already exists (likely created previously). Auto-adopting it into state...');
    const adopted = await tryAdoptArtifactsBucket({
      repoRoot,
      tfvarsPath,
      environment,
      region,
      bucketNameHint: hints.bucketName,
    });
    adoptedAny = adoptedAny || adopted;
  }

  if (combinedOutput.includes('EntityAlreadyExists') && (hints.roleName || hints.profileName)) {
    warn('IAM resource already exists (likely created previously). Auto-adopting it into state...');
    const adopted = await tryAdoptIamRoleAndProfile({
      repoRoot,
      tfvarsPath,
      roleName: hints.roleName,
      profileName: hints.profileName,
      env,
    });
    adoptedAny = adoptedAny || adopted;
  }

  return adoptedAny;
}

async function tryAdoptEc2KeyPair({ repoRoot, tfvarsPath, keyName, env }) {
  if (!keyName) return false;

  info(`Attempting to adopt existing EC2 key pair into state: ${keyName}`);
  const code = await runCommandAllowFailure(
    'terraform',
    ['-chdir=terraform', 'import', `-var-file=${tfvarsPath}`, 'aws_key_pair.deployer', keyName],
    { cwd: repoRoot, env },
  );

  if (code === 0) {
    ok('EC2 key pair adopted into state (import succeeded).');
    return true;
  }

  warn('EC2 key pair import failed; continuing without auto-adopt.');
  return false;
}

function parseRegionMap(terraformLocalsPath) {
  const fallback = [
    { label: 'Paris', value: 'Paris', region: 'eu-west-3' },
    { label: 'EU', value: 'EU', region: 'eu-west-3' },
    { label: 'Ireland', value: 'Ireland', region: 'eu-west-1' },
    { label: 'Frankfurt', value: 'Frankfurt', region: 'eu-central-1' },
    { label: 'Stockholm', value: 'Stockholm', region: 'eu-north-1' },
    { label: 'Virginia', value: 'Virginia', region: 'us-east-1' },
    { label: 'Ohio', value: 'Ohio', region: 'us-east-2' },
  ];

  try {
    const content = fs.readFileSync(terraformLocalsPath, 'utf8');
    const blockMatch = content.match(/region_map\s*=\s*\{([\s\S]*?)\n\s*\}/m);
    if (!blockMatch) return fallback;

    const body = blockMatch[1];
    const entries = [];
    const lineRe = /^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]+)"\s*$/gm;
    let m;
    while ((m = lineRe.exec(body)) !== null) {
      entries.push({ label: `${m[1]} (${m[2]})`, value: m[1], region: m[2] });
    }

    return entries.length > 0 ? entries : fallback;
  } catch {
    return fallback;
  }
}

function toWorkspaceName(environment, region) {
  const raw = `${environment}-${region}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

async function promptText(rl, message, { defaultValue = '' } = {}) {
  const suffix = defaultValue ? chalk.dim(` (default: ${defaultValue})`) : '';
  const answer = (await rl.question(`${message}${suffix}: `)).trim();
  return answer.length > 0 ? answer : defaultValue;
}

async function promptConfirm(rl, message, { defaultYes = true } = {}) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const answer = (await rl.question(`${message} ${chalk.dim(hint)} `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    if (['y', 'yes'].includes(answer)) return true;
    if (['n', 'no'].includes(answer)) return false;
    warn('Please answer y or n.');
  }
}

async function promptSelect(rl, message, options, { defaultIndex = 0 } = {}) {
  console.log(message);

  options.forEach((opt, idx) => {
    const num = String(idx + 1).padStart(2, ' ');
    const line = `${chalk.dim(num)}  ${opt.label}`;
    console.log(line);
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hint = `Choose 1-${options.length} (default: ${defaultIndex + 1})`;
    const answer = (await rl.question(`${chalk.dim(hint)}: `)).trim();
    const chosenIndex = answer ? Number(answer) - 1 : defaultIndex;

    if (Number.isInteger(chosenIndex) && chosenIndex >= 0 && chosenIndex < options.length) {
      return options[chosenIndex];
    }

    warn(`Please enter a number between 1 and ${options.length}.`);
  }
}

function renderTfvars({
  environment,
  regionChoice,
  costProfile,
  enableAlb,
  enableDatabase,
  enableCloudfront,
  domainName,
  hostedZoneId,
  sshKeyName,
  sshPublicKeyPath,
  sshPrivateKeyPath,
}) {
  const lines = [
    `environment = "${environment}"`,
    '',
    `region_choice = "${regionChoice}"`,
    '',
    `cost_profile = "${costProfile}"`,
    `enable_alb = ${enableAlb}`,
    `enable_cloudfront = ${enableCloudfront}`,
    `enable_database = ${enableDatabase}`,
    '',
    ...(domainName && hostedZoneId
      ? [`domain_name = "${domainName}"`, `hosted_zone_id = "${hostedZoneId}"`, '']
      : []),
    `ssh_key_name = "${sshKeyName}"`,
    `ssh_public_key_path = "${sshPublicKeyPath}"`,
    `ssh_private_key_path = "${sshPrivateKeyPath}"`,
    '',
    '# Leave unset to use the default AWS credential chain or export AWS_PROFILE.',
    '# aws_profile = "your-profile"',
    '',
  ];

  return lines.join('\n');
}

async function main() {
  process.stdout.write('\u001Bc'); // clear screen

  title('ft_iac deploy');
  info('Interactive Terraform deploy for this repo.');
  console.log(chalk.dim('No secrets are written into the repository; SSH keys are generated under ~/.ssh/.'));
  console.log('');

  const repoRoot = path.resolve(__dirname, '..');
  const terraformDir = path.join(repoRoot, 'terraform');
  const localsPath = path.join(terraformDir, 'locals.tf');
  const tfvarsPath = path.join(terraformDir, 'terraform.tfvars');

  if (!fs.existsSync(terraformDir)) {
    err(`Terraform directory not found: ${terraformDir}`);
    process.exit(1);
  }

  const missing = [];
  if (!commandExists('terraform')) missing.push('terraform');
  if (!commandExists('ssh-keygen')) missing.push('ssh-keygen');

  if (missing.length > 0) {
    err(`Missing required tools: ${missing.join(', ')}`);
    info('Install them first, then re-run `pnpm deploy`.');
    process.exit(1);
  }

  if (!commandExists('aws')) {
    warn('AWS CLI not found. Terraform can still work via the AWS SDK credential chain, but AWS CLI is recommended for verification.');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const environment = await promptText(rl, 'Environment name', { defaultValue: 'dev' });

    const deployMode = await promptSelect(
      rl,
      'Choose deployment mode:',
      [
        { label: 'Standard (HA: ALB + ASG(2+) + RDS)  — recommended', value: 'standard' },
        { label: 'Free (single EC2, no ALB/RDS)        — lowest cost', value: 'free' },
      ],
      { defaultIndex: 0 },
    );

    const regionOptions = parseRegionMap(localsPath);
    const chosenRegion = await promptSelect(rl, 'Choose a region:', regionOptions, { defaultIndex: 0 });

    const costProfile = deployMode.value;
    const enableAlb = costProfile === 'standard' ? 'true' : 'false';
    const enableDatabase = costProfile === 'standard' ? 'true' : 'false';
    const enableCloudfront = 'false';

    const workspaceName = toWorkspaceName(environment, chosenRegion.region);

    console.log('');
    title('SSH key');

    const defaultKeyBaseName = `ft_iac_${environment}_${chosenRegion.value}`.replace(/[^A-Za-z0-9_-]/g, '_');
    const defaultKeyPath = path.join(os.homedir(), '.ssh', defaultKeyBaseName);

    const keyPath = expandHome(await promptText(rl, 'SSH private key path', { defaultValue: defaultKeyPath }));
    const keyPubPath = `${keyPath}.pub`;

    const keyExists = fs.existsSync(keyPath) || fs.existsSync(keyPubPath);
    if (keyExists) {
      warn(`Key already exists at ${keyPath}`);
      const reuse = await promptConfirm(rl, 'Reuse existing key?', { defaultYes: true });
      if (!reuse) {
        const overwrite = await promptConfirm(rl, 'Overwrite the existing key files?', { defaultYes: false });
        if (!overwrite) {
          err('Cancelled.');
          process.exit(1);
        }

        try { fs.unlinkSync(keyPath); } catch {}
        try { fs.unlinkSync(keyPubPath); } catch {}
      }
    }

    if (!fs.existsSync(keyPath) || !fs.existsSync(keyPubPath)) {
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      info('Generating an ed25519 keypair (no passphrase)...');
      await runCommand('ssh-keygen', ['-t', 'ed25519', '-f', keyPath, '-N', '', '-C', `${environment}@ft_iac`], {
        cwd: repoRoot,
      });
      ok(`Generated ${keyPath} and ${keyPubPath}`);
    } else {
      ok('Using existing SSH keypair.');
    }

    console.log('');
    title('Terraform inputs');

    const tfvarsDir = path.join(terraformDir, '.deploy');
    fs.mkdirSync(tfvarsDir, { recursive: true });
    const tfvarsPath = path.join(tfvarsDir, `${workspaceName}.tfvars`);

    const tfvarsContent = renderTfvars({
      environment,
      regionChoice: chosenRegion.value,
      costProfile,
      enableAlb,
      enableCloudfront,
      enableDatabase,
      domainName: '',
      hostedZoneId: '',
      // Key pair names are regional and must be unique within the region.
      // Scope it to the Terraform workspace to avoid collisions when switching regions.
      sshKeyName: `ft-iac-${workspaceName}`,
      sshPublicKeyPath: keyPubPath,
      sshPrivateKeyPath: keyPath,
    });

    fs.writeFileSync(tfvarsPath, tfvarsContent, { encoding: 'utf8' });
    try {
      fs.chmodSync(tfvarsPath, 0o600);
    } catch {
      // best-effort on non-POSIX
    }

    ok(`Wrote ${path.relative(repoRoot, tfvarsPath)}`);
    ok(`Terraform workspace: ${workspaceName}`);

    console.log('');
    title('Terraform run');

    const proceed = await promptConfirm(rl, 'Run terraform init + plan now?', { defaultYes: true });
    if (!proceed) {
      warn('Stopped before running Terraform.');
      process.exit(0);
    }

    await runCommand('terraform', ['-chdir=terraform', 'init'], { cwd: repoRoot });

    // Keep one state per region to avoid "VPC not found" errors when switching regions.
    const selectCode = await runCommandAllowFailure(
      'terraform',
      ['-chdir=terraform', 'workspace', 'select', workspaceName],
      { cwd: repoRoot },
    );
    if (selectCode !== 0) {
      await runCommand('terraform', ['-chdir=terraform', 'workspace', 'new', workspaceName], { cwd: repoRoot });
    }

    await runCommand('terraform', ['-chdir=terraform', 'validate'], { cwd: repoRoot });
    await runCommand('terraform', ['-chdir=terraform', 'plan', '-no-color', `-var-file=${tfvarsPath}`], { cwd: repoRoot });

    console.log('');
    const apply = await promptConfirm(rl, 'Apply these changes (terraform apply)?', { defaultYes: false });
    if (!apply) {
      warn('Plan completed; apply skipped.');
      process.exit(0);
    }

    const tfEnv = {
      ...process.env,
      AWS_REGION: chosenRegion.region,
      AWS_DEFAULT_REGION: chosenRegion.region,
      AWS_PAGER: '',
    };

    const sshKeyName = `ft-iac-${workspaceName}`;

    // Apply with one retry path for the common "bucket was created but state missed it" scenario.
    const applyAttempt1 = await runCommandCaptureStreaming(
      'terraform',
      ['-chdir=terraform', 'apply', '-auto-approve', `-var-file=${tfvarsPath}`],
      { cwd: repoRoot, env: tfEnv },
    );

    if (applyAttempt1.code !== 0) {
      const combined = `${applyAttempt1.stdout}\n${applyAttempt1.stderr}`;
      const adoptedAny = await tryAutoAdoptConflicts({
        combinedOutput: combined,
        repoRoot,
        tfvarsPath,
        environment,
        region: chosenRegion.region,
        sshKeyName,
        env: tfEnv,
      });

      if (adoptedAny) {
        info('Retrying terraform apply once after auto-adopt...');
        await runCommand('terraform', ['-chdir=terraform', 'apply', '-auto-approve', `-var-file=${tfvarsPath}`], {
          cwd: repoRoot,
          env: tfEnv,
        });
      } else {
        throw new Error('Terraform apply failed and auto-adopt was not possible.');
      }
    }

    // Optional HTTPS step (keep HTTP as the default deployment).
    if (costProfile === 'standard') {
      console.log('');
      title('HTTPS (optional)');
      info('Default is HTTP. If you enable HTTPS, Terraform will add the required AWS resources.');

      const addHttps = await promptConfirm(rl, 'Enable HTTPS now?', { defaultYes: false });
      if (addHttps) {
        const httpsMode = await promptSelect(
          rl,
          'How do you want HTTPS?',
          [
            {
              label: 'Custom domain (Route53 + ACM on ALB, redirects HTTP→HTTPS) — recommended',
              value: 'route53',
            },
            {
              label: 'CloudFront HTTPS domain (no domain required, extra cost)',
              value: 'cloudfront',
            },
          ],
          { defaultIndex: 0 },
        );

        let tlsDomainName = '';
        let tlsHostedZoneId = '';
        let tlsEnableCloudfront = 'false';

        if (httpsMode.value === 'route53') {
          info('You must provide BOTH values or HTTPS will be skipped.');
          tlsDomainName = await promptText(rl, 'Domain name (FQDN, e.g. app.example.com)', { defaultValue: '' });
          tlsHostedZoneId = await promptText(rl, 'Route53 hosted zone ID (e.g. Z123...)', { defaultValue: '' });

          if (!tlsDomainName || !tlsHostedZoneId) {
            warn('HTTPS skipped: both domain name and hosted zone ID are required.');
            tlsDomainName = '';
            tlsHostedZoneId = '';
          }
        } else {
          tlsEnableCloudfront = 'true';
        }

        if (httpsMode.value === 'cloudfront' || (tlsDomainName && tlsHostedZoneId)) {
          const tlsTfvarsContent = renderTfvars({
            environment,
            regionChoice: chosenRegion.value,
            costProfile,
            enableAlb,
            enableCloudfront: tlsEnableCloudfront,
            enableDatabase,
            domainName: tlsDomainName,
            hostedZoneId: tlsHostedZoneId,
            sshKeyName,
            sshPublicKeyPath: keyPubPath,
            sshPrivateKeyPath: keyPath,
          });

          fs.writeFileSync(tfvarsPath, tlsTfvarsContent, { encoding: 'utf8' });
          try {
            fs.chmodSync(tfvarsPath, 0o600);
          } catch {
            // best-effort
          }

          info('Applying HTTPS changes (DNS/ACM validation can take a minute)...');
          const tlsEnv = {
            ...process.env,
            AWS_REGION: chosenRegion.region,
            AWS_DEFAULT_REGION: chosenRegion.region,
            AWS_PAGER: '',
          };

          const tlsApplyAttempt1 = await runCommandCaptureStreaming(
            'terraform',
            ['-chdir=terraform', 'apply', '-auto-approve', `-var-file=${tfvarsPath}`],
            { cwd: repoRoot, env: tlsEnv },
          );

          if (tlsApplyAttempt1.code !== 0) {
            const combined = `${tlsApplyAttempt1.stdout}\n${tlsApplyAttempt1.stderr}`;
            const adoptedAny = await tryAutoAdoptConflicts({
              combinedOutput: combined,
              repoRoot,
              tfvarsPath,
              environment,
              region: chosenRegion.region,
              sshKeyName,
              env: tlsEnv,
            });

            if (adoptedAny) {
              info('Retrying terraform apply once after auto-adopt...');
              await runCommand('terraform', ['-chdir=terraform', 'apply', '-auto-approve', `-var-file=${tfvarsPath}`], {
                cwd: repoRoot,
                env: tlsEnv,
              });
            } else {
              throw new Error('Terraform apply failed and auto-adopt was not possible.');
            }
          }

          ok('HTTPS enabled.');
        }
      }
    }

    console.log('');
    title('Done');
    info('Useful outputs:');

    const outputsToShow = ['app_endpoint', 'https_endpoint', 'selected_region', 'alb_dns', 'asg_name'];
    for (const outName of outputsToShow) {
      try {
        const chunks = [];
        const child = spawn('terraform', ['-chdir=terraform', 'output', '-raw', outName], { cwd: repoRoot });
        child.stdout.on('data', (d) => chunks.push(d));
        await new Promise((resolve, reject) => {
          child.on('error', reject);
          child.on('exit', (code) => (code === 0 ? resolve() : resolve()));
        });
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (raw) {
          const label = chalk.dim(outName.padEnd(16, ' '));
          const value = raw;
          const line = `${label} ${value}`;
          console.log(stripAnsi(line));
        }
      } catch {
        // ignore missing outputs
      }
    }

    console.log('');
    ok('Deployment finished.');
  } catch (e) {
    err(e && e.message ? e.message : String(e));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
