#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { spawn } = require('child_process');

const chalk = require('chalk');

function hr(char = '─') {
  const width = Math.max(40, Math.min(100, (process.stdout.columns || 80) - 2));
  return char.repeat(width);
}

function title(text) {
  console.log(chalk.bold.red(text));
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

function promptOptions(rl, message, options, { defaultIndex = 0 } = {}) {
  return (async () => {
    console.log(message);
    options.forEach((opt, idx) => {
      const num = String(idx + 1).padStart(2, ' ');
      console.log(`${chalk.dim(num)}  ${opt.label}`);
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const answer = (await rl.question(chalk.dim(`Choose 1-${options.length} (default: ${defaultIndex + 1}): `))).trim();
      const chosenIndex = answer ? Number(answer) - 1 : defaultIndex;
      if (Number.isInteger(chosenIndex) && chosenIndex >= 0 && chosenIndex < options.length) {
        return options[chosenIndex];
      }
      warn(`Please enter a number between 1 and ${options.length}.`);
    }
  })();
}

async function promptConfirm(rl, message, { defaultYes = false } = {}) {
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

function parseTfvarsForKeys(tfvarsPath) {
  try {
    const content = fs.readFileSync(tfvarsPath, 'utf8');
    const privateMatch = content.match(/^[ \t]*ssh_private_key_path[ \t]*=[ \t]*"([^"]+)"[ \t]*$/m);
    const publicMatch = content.match(/^[ \t]*ssh_public_key_path[ \t]*=[ \t]*"([^"]+)"[ \t]*$/m);

    return {
      privateKey: privateMatch ? privateMatch[1] : '',
      publicKey: publicMatch ? publicMatch[1] : '',
    };
  } catch {
    return { privateKey: '', publicKey: '' };
  }
}

function collectDeployTargets(tfvarsDir) {
  if (!fs.existsSync(tfvarsDir)) return [];

  return fs.readdirSync(tfvarsDir)
    .filter((name) => name.endsWith('.tfvars'))
    .map((name) => {
      const workspaceName = name.replace(/\.tfvars$/, '');
      const tfvarsPath = path.join(tfvarsDir, name);
      const keys = parseTfvarsForKeys(tfvarsPath);
      return {
        workspaceName,
        tfvarsPath,
        ...keys,
      };
    })
    .sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
}

async function destroyWorkspace(repoRoot, target) {
  info(`Selecting Terraform workspace: ${target.workspaceName}`);
  const selectCode = await runCommandAllowFailure(
    'terraform',
    ['-chdir=terraform', 'workspace', 'select', target.workspaceName],
    { cwd: repoRoot },
  );

  if (selectCode !== 0) {
    warn(`Workspace ${target.workspaceName} not found. Skipping.`);
    return false;
  }

  info(`Destroying resources using ${path.relative(repoRoot, target.tfvarsPath)}...`);
  await runCommand(
    'terraform',
    ['-chdir=terraform', 'destroy', '-auto-approve', `-var-file=${target.tfvarsPath}`],
    { cwd: repoRoot },
  );

  ok(`Destroyed infrastructure for workspace ${target.workspaceName}.`);
  return true;
}

async function main() {
  process.stdout.write('\u001Bc');

  title('ft_iac destroy');
  warn('This will permanently delete Terraform-managed AWS resources for selected deployments.');
  console.log('');

  if (!commandExists('terraform')) {
    err('Missing required tool: terraform');
    process.exit(1);
  }

  const repoRoot = path.resolve(__dirname, '..');
  const terraformDir = path.join(repoRoot, 'terraform');
  const tfvarsDir = path.join(terraformDir, '.deploy');

  if (!fs.existsSync(terraformDir)) {
    err(`Terraform directory not found: ${terraformDir}`);
    process.exit(1);
  }

  const targets = collectDeployTargets(tfvarsDir);
  if (targets.length === 0) {
    err('No deployment tfvars found under terraform/.deploy/.');
    info('Run `pnpm run deploy` first, or destroy manually with terraform commands.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    await runCommand('terraform', ['-chdir=terraform', 'init'], { cwd: repoRoot });

    const destroyAllOption = { label: `Destroy ALL deployments (${targets.length})`, value: 'all' };
    const perWorkspaceOptions = targets.map((t) => ({
      label: `Destroy ${t.workspaceName}`,
      value: t.workspaceName,
    }));

    const choice = await promptOptions(
      rl,
      'Choose what to destroy:',
      [destroyAllOption, ...perWorkspaceOptions],
      { defaultIndex: 0 },
    );

    const selectedTargets = choice.value === 'all'
      ? targets
      : targets.filter((t) => t.workspaceName === choice.value);

    if (selectedTargets.length === 0) {
      err('No deployment selected.');
      process.exit(1);
    }

    console.log('');
    warn(`You are about to destroy ${selectedTargets.length} deployment(s):`);
    selectedTargets.forEach((t) => console.log(`  - ${t.workspaceName}`));

    const confirmed = await promptConfirm(rl, 'Continue?', { defaultYes: false });
    if (!confirmed) {
      warn('Cancelled. Nothing destroyed.');
      process.exit(0);
    }

    let destroyedCount = 0;
    const failed = [];

    for (const target of selectedTargets) {
      console.log('');
      title(`Destroy ${target.workspaceName}`);
      try {
        const didDestroy = await destroyWorkspace(repoRoot, target);
        if (didDestroy) destroyedCount += 1;
      } catch (e) {
        failed.push(target.workspaceName);
        err(`Failed destroying ${target.workspaceName}: ${e && e.message ? e.message : String(e)}`);
      }
    }

    if (destroyedCount > 0) {
      await runCommandAllowFailure('terraform', ['-chdir=terraform', 'workspace', 'select', 'default'], { cwd: repoRoot });
    }

    if (destroyedCount > 0) {
      const deleteWorkspaces = await promptConfirm(
        rl,
        'Delete destroyed Terraform workspace(s) from local state?',
        { defaultYes: true },
      );

      if (deleteWorkspaces) {
        for (const target of selectedTargets) {
          if (failed.includes(target.workspaceName)) continue;
          const code = await runCommandAllowFailure(
            'terraform',
            ['-chdir=terraform', 'workspace', 'delete', target.workspaceName],
            { cwd: repoRoot },
          );
          if (code === 0) ok(`Deleted workspace ${target.workspaceName}.`);
          else warn(`Could not delete workspace ${target.workspaceName}.`);
        }
      }

      const removeTfvars = await promptConfirm(rl, 'Delete related tfvars files from terraform/.deploy/?', {
        defaultYes: true,
      });

      if (removeTfvars) {
        for (const target of selectedTargets) {
          if (failed.includes(target.workspaceName)) continue;
          try {
            fs.unlinkSync(target.tfvarsPath);
            ok(`Removed ${path.relative(repoRoot, target.tfvarsPath)}.`);
          } catch {
            warn(`Could not remove ${path.relative(repoRoot, target.tfvarsPath)}.`);
          }
        }
      }

      const removeKeys = await promptConfirm(rl, 'Delete related SSH keypairs from ~/.ssh/?', {
        defaultYes: false,
      });

      if (removeKeys) {
        const toDelete = new Set();
        selectedTargets.forEach((target) => {
          if (failed.includes(target.workspaceName)) return;
          if (target.privateKey) toDelete.add(target.privateKey);
          if (target.publicKey) toDelete.add(target.publicKey);
        });

        toDelete.forEach((filePath) => {
          try {
            const expanded = filePath.startsWith('~/') ? path.join(os.homedir(), filePath.slice(2)) : filePath;
            if (fs.existsSync(expanded)) {
              fs.unlinkSync(expanded);
              ok(`Removed ${expanded}.`);
            }
          } catch {
            warn(`Could not remove ${filePath}.`);
          }
        });
      }
    }

    console.log('');
    title('Destroy summary');
    info(`Destroyed: ${destroyedCount}`);
    info(`Failed: ${failed.length}`);
    if (failed.length > 0) {
      failed.forEach((name) => warn(`- ${name}`));
      process.exit(1);
    }

    ok('Done.');
  } catch (e) {
    err(e && e.message ? e.message : String(e));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
