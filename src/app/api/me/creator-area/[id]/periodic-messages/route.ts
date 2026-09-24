import { periodicOwnerRequest } from "@/lib/creators/periodic-messages-api";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { return periodicOwnerRequest(request, (await params).id); }
export async function POST(request: Request, { params }: Context) { return periodicOwnerRequest(request, (await params).id); }
