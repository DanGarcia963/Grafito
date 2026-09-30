"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const runtime_1 = require("./config/runtime");
async function bootstrap() {
    (0, runtime_1.allowedOrigins)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors(runtime_1.corsOptions);
    app.enableShutdownHooks();
    const port = (0, runtime_1.integerEnv)('PORT', 4002);
    await app.listen(port, process.env.HOST || '0.0.0.0');
    console.log(`Backend escuchando en el puerto ${port}`);
}
bootstrap().catch(error => { console.error('No se pudo iniciar el backend:', error.message); process.exitCode = 1; });
//# sourceMappingURL=main.js.map