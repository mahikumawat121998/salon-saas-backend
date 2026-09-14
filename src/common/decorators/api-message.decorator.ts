import { SetMetadata } from "@nestjs/common";

export const ApiMessage = (message: string) => SetMetadata("api_message", message);
