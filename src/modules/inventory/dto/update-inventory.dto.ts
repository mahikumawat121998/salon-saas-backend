import { CreateInventoryDto } from './create-inventory.dto';

// Re-implementing PartialType logic manually to avoid mapped-types dependency for now
export class UpdateInventoryDto extends CreateInventoryDto {}
