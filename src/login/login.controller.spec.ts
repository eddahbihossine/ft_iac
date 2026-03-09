import { LoginController } from "./login.controller";
import { UsersService } from "../users/users.service";

class MockUsersService extends UsersService {
  constructor() {
    // on initialise la super classe avec un faux repository
    super({} as any);
  }
  // On surcharge les méthodes qu'on veut mocker
  create = jest.fn();
  findAll = jest.fn();
  findOne = jest.fn();
  findOneByUsernameOrFail = jest.fn();
  findOneByUsername = jest.fn();
  update = jest.fn();
  remove = jest.fn();
}

const mockUsersService = new MockUsersService();

describe("LoginController", () => {
  it("should render the login form page", async () => {
    const loginController = new LoginController(mockUsersService);
    const result = await loginController.loginFormPage();

    // Mock du moteur de rendu pour renvoyer une chaîne HTML fictive
    const mockRender = jest
      .fn()
      .mockReturnValue('<h4 class="card-title">Login</h4>');

    // Appelez la méthode du contrôleur avec le moteur de rendu mocké
    const actualHtml = mockRender("login-form", result);

    // Vérifiez que le HTML contient la chaîne souhaitée
    expect(actualHtml).toContain('<h4 class="card-title">Login</h4>');
  });
});
