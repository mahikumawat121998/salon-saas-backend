const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AuthService } = require('./dist/modules/auth/auth.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  // find owner user
  const user = await authService.prisma.user.findFirst({ where: { email: 'owner@glamourhaven.com' } });
  const result = await authService.getMe(user.id);
  console.log(result);
  await app.close();
}

main().catch(console.error);
