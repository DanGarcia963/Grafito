"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.booleanInput = booleanInput;
const common_1 = require("@nestjs/common");
function booleanInput(value) {
    if (value === true || value === 1 || value === 'true' || value === '1')
        return true;
    if (value === false || value === 0 || value === 'false' || value === '0')
        return false;
    throw new common_1.BadRequestException('Valor booleano inválido');
}
//# sourceMappingURL=inputs.js.map