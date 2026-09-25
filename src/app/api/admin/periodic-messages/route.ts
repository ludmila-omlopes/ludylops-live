import { periodicOwnerRequest } from "@/lib/creators/periodic-messages-api";
export async function GET(request: Request) { return periodicOwnerRequest(request); }
export async function POST(request: Request) { return periodicOwnerRequest(request); }
