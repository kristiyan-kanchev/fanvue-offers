import { budgetFor } from "@/actions/draft-budget";
import { PLAN_BODY, preparePlan } from "@/actions/registry";
import { isActionKind } from "@/audit/types";
import { requireCreatorData } from "@/data/get-source";
import { apiError, errorResponse, json } from "@/server/http";

export const dynamic = "force-dynamic";

/** A fix's plan and a freshly drafted message, for a chosen approach and offer. Sends nothing. */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!isActionKind(kind)) return apiError("not_found", "There is no fix of that kind.", 404);

  try {
    const body = PLAN_BODY.safeParse(await request.json().catch(() => ({})));
    if (!body.success) return apiError("bad_request", "Those settings are out of range.", 400);

    const data = await requireCreatorData();
    const snapshot = await data.getSnapshot();
    const prepared = await preparePlan(kind, snapshot, body.data, {
      budget: budgetFor(data.mode, snapshot.creator.uuid),
    });
    if (!prepared) return apiError("bad_request", "That isn't an option for this fix.", 400);

    const { plan, draft } = prepared;
    return json({ plan, draft: { text: draft.text, source: draft.source, warning: draft.warning ?? null } });
  } catch (cause) {
    return errorResponse(cause);
  }
}
