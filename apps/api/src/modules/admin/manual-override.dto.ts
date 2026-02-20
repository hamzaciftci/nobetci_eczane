import { Type } from "class-transformer";
import {
  IsBoolean,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class ManualOverrideDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  il!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  ilce!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  eczane_adi!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  adres!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(24)
  telefon!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "duty_date must be YYYY-MM-DD" })
  duty_date?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  dogruluk_puani?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  dogrulama_kaynagi_sayisi?: number;

  @IsOptional()
  @IsBoolean()
  is_degraded?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  source_note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  updated_by?: string;
}
