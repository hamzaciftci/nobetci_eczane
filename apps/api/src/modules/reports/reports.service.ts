import { BadRequestException, Injectable } from "@nestjs/common";
import { QueryResultRow } from "pg";
import { toSlug } from "@nobetci/shared";
import { DatabaseService } from "../../infra/database.service";
import { CreateReportDto } from "./create-report.dto";

type ProvinceRow = QueryResultRow & { id: number };
type DistrictRow = QueryResultRow & { id: number };

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateReportDto) {
    const provinceSlug = toSlug(dto.il);
    const province = await this.db.query<ProvinceRow>(
      `select id from provinces where slug = $1`,
      [provinceSlug]
    );

    if (!province.rowCount) {
      throw new BadRequestException("Unknown province");
    }

    let districtId: number | null = null;
    if (dto.ilce) {
      const districtSlug = toSlug(dto.ilce);
      const district = await this.db.query<DistrictRow>(
        `select id from districts where province_id = $1 and slug = $2`,
        [province.rows[0].id, districtSlug]
      );
      districtId = district.rowCount ? district.rows[0].id : null;
    }

    const insert = await this.db.query<{ id: string }>(
      `
      insert into correction_reports (
        province_id, district_id, pharmacy_name, issue_type, note, contact_opt_in
      )
      values ($1, $2, $3, $4, $5, $6)
      returning id::text
      `,
      [
        province.rows[0].id,
        districtId,
        dto.eczane_adi,
        dto.sorun_turu,
        dto.not ?? null,
        dto.iletisim_izni
      ]
    );

    return {
      id: insert.rows[0].id,
      status: "received"
    };
  }
}
