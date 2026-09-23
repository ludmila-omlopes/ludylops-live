import { describe, expect, it } from "vitest";

import {
  groupStreamerbotScripts,
  streamerbotScriptCategories,
} from "@/lib/streamerbot/scripts-catalog";
import { listStreamerbotScripts } from "@/lib/streamerbot/scripts.server";
import { buildCredentialSignature } from "@/lib/streamerbot/credential-crypto";
import { createHmac } from "node:crypto";

describe("streamerbot scripts catalog", () => {
  it("loads every cataloged C# file from streamerbot/", () => {
    const scripts = listStreamerbotScripts();

    expect(scripts.length).toBeGreaterThanOrEqual(11);
    expect(scripts.every((script) => script.source.includes("public class CPHInline"))).toBe(true);
    expect(scripts.find((script) => script.id === "like-count-update")?.trigger).toContain(
      "Statistics Updated",
    );
  });

  it("groups scripts by category with Portuguese labels", () => {
    const grouped = groupStreamerbotScripts(listStreamerbotScripts());

    expect(grouped.some((entry) => entry.category === "live" && entry.label === "Live e recompensas")).toBe(
      true,
    );
    expect(grouped.every((entry) => entry.scripts.length > 0)).toBe(true);
    expect(Object.keys(streamerbotScriptCategories)).toHaveLength(6);
  });

  it("every HTTP script sends the credential ID and signs the same UTF-8 envelope as the server", () => {
    const timestamp = "1789900000000";
    const credentialId = `sbc_${"a".repeat(32)}`;
    const body = '{"body":"Você chegou! 🌟"}';
    const secret = "test-vector-secret";
    const scripts = listStreamerbotScripts().filter((script) => script.source.includes("BuildSignature("));
    expect(scripts).toHaveLength(12);
    for (const script of scripts) {
      expect(script.source).toContain('"x-streamerbot-credential-id", credentialId');
      expect(script.source).toContain('"lojaneon.streamerbotCredentialId"');
      expect(script.source).toContain('"lojaneon.streamerbotCredentialSecret"');
      expect(script.source).not.toContain("lojaneon.streamerbotSharedSecret");
      const format = script.source.match(/string\.Format\("(v2\\n[^"\r\n]+)", timestamp, credentialId, body\)/u)?.[1];
      expect(format, script.filename).toBeDefined();
      const canonical = format!.replaceAll("\\n", "\n").replace("{0}", timestamp).replace("{1}", credentialId).replace("{2}", body);
      const pathname = canonical.split("\n")[4];
      expect(script.source).toContain(pathname);
      expect(createHmac("sha256", secret).update(canonical, "utf8").digest("hex")).toBe(buildCredentialSignature({ credentialId, timestamp, body, secret, method: "POST", pathname }));
    }
  });
});
