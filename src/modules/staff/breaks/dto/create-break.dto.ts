import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from "class-validator";

export class CreateBreakDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "startTime must be in HH:mm format (e.g. 13:00)",
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "endTime must be in HH:mm format (e.g. 14:00)",
  })
  endTime: string;
}
