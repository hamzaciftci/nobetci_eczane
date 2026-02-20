import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const ISSUE_TYPES = ["telefon_yanlis", "adres_yanlis", "nobette_degil", "kapali", "diger"] as const;

export class CreateReportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  il!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  ilce?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(128)
  eczane_adi!: string;

  @IsIn(ISSUE_TYPES)
  sorun_turu!: (typeof ISSUE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  not?: string;

  @IsBoolean()
  iletisim_izni!: boolean;
}
