import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_TOKEN;
    if (!expected) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = request.headers["x-admin-token"];
    if (provided === expected) {
      return true;
    }

    throw new UnauthorizedException("Missing or invalid admin token");
  }
}
