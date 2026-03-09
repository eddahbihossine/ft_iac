import { test, expect, type Page } from "@playwright/test";

const host = process.env.TEST_HOST || "http://localhost:3000";
const username = process.env.TEST_USERNAME || "toto";

test.beforeEach(async ({ page }) => {
  await page.goto(host);
});

test.describe("Landing", () => {
  test("should show login page on first load", async ({ page }) => {
    // Clear cookies
    await page.context().clearCookies();

    // Check if the page as redirected to /login
    await expect(page).toHaveURL(`${host}/login`);
  });
});

test.describe("Login", () => {
  test("should show login form on login page", async ({ page }) => {
    // Go to login page
    await page.goto(`${host}/login`);

    // Check if the login form is visible
    await expect(page.locator("form")).toBeVisible();

    // Check if "Login" in <h4> tag is visible
    await expect(page.locator("h4")).toHaveText("Login");

    // Check if the "Username" input is visible
    await expect(page.getByPlaceholder("Username")).toBeVisible();

    // Check if the "Login" button is visible
    await expect(page.locator("button")).toHaveText("Login");
  });

  test("should change page to user's todos on successful login", async ({
    page,
  }) => {
    // Login
    await login(page, username);

    // Check if the page as redirected to /todos/{userId}
    await expect(page).toHaveURL(/\/todos\/\d+/);

    // Check if the username is in the header (title format : "{username} todos list")
    await expect(page.locator("h1")).toHaveText(`${username} todos list`);
  });
});

test.describe.serial("Todo workflow", () => {
  // WARNING : this tests are not independent, they should be run in order

  test("should show new todo form on todos page", async ({ page }) => {
    // Login
    await login(page, username);

    // Check if the new todo form is visible
    await expect(page.locator("form")).toBeVisible();

    // Check if "New Todo" in <h4> tag is visible
    await expect(page.getByRole("heading", { name: "New Todo" })).toHaveText(
      "New Todo"
    );

    // Check if the "Title" input is visible
    await expect(page.getByPlaceholder("Title")).toBeVisible();

    // Check if the "Description" input is visible
    await expect(page.getByPlaceholder("Description")).toBeVisible();

    // Check if the "Create" button is visible
    await expect(
      page.getByRole("button", { name: "Create todo" })
    ).toBeVisible();
  });

  // Set variables for the new todo
  const randomTodoTitle = `My todo ${Math.floor(Math.random() * 1000)}`;
  const randomTodoDescription = `My todo description ${Math.floor(
    Math.random() * 1000
  )}`;

  test("should add a new todo on successful form submit", async ({ page }) => {
    // Login
    await login(page, username);

    // Fill in the new todo form
    await page.getByPlaceholder("Title").fill(randomTodoTitle);
    await page.getByPlaceholder("Description").fill(randomTodoDescription);

    // Submit the new todo form
    await page.getByRole("button", { name: "Create todo" }).click();

    // Check if the todo has been added
    await expect(
      page.getByRole("heading", { name: randomTodoTitle })
    ).toBeVisible();
  });

  test("should check a todo on check button click", async ({ page }) => {
    // Login
    await login(page, username);

    // Get the todo id from the badge
    const todoId: number = await page
      .getByRole("heading", { name: randomTodoTitle })
      .locator(".badge")
      .textContent()
      .then((text) => parseInt(text.trim()));

    // Check if the todo checkbox is visible and not checked
    const todoCheckbox = page.locator(
      `.todo-checkbox[data-todo-id="${todoId}"]`
    );
    await expect(todoCheckbox).toBeVisible();
    await expect(todoCheckbox).not.toBeChecked();

    // Click on checkbox
    await todoCheckbox.click();

    // Check if the todo checkbox is checked
    await expect(todoCheckbox).toBeChecked();
  });

  test("should delete a todo on delete button click", async ({ page }) => {
    // login
    await login(page, username);

    // Get the todo id from the badge
    const todoId: number = await page
      .getByRole("heading", { name: randomTodoTitle })
      .locator(".badge")
      .textContent()
      .then((text) => parseInt(text.trim()));

    // Click on delete button
    await page.click(`.todo-delete-button[data-todo-id="${todoId}"]`);

    // Check if the todo has been deleted
    await expect(
      page.getByRole("heading", { name: randomTodoTitle })
    ).not.toBeVisible();
  });
});

// Utility functions ===========================================================

async function login(page: Page, username: string) {
  // Go to login page
  await page.goto(`${host}/login`);

  // Fill in the login form
  await page.getByPlaceholder("Username").fill(username);

  // Submit the login form
  await page.click("button");
}
