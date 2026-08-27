/**
 * `require-trusted-types-for 'script'` covers service worker registration too:
 * `register()` takes a script URL, so a plain string is refused. Rather than
 * dropping the directive, this hands it a policy that will vouch for exactly one
 * thing — this app's own service worker, same origin, at the expected path.
 *
 * The policy is the narrowest possible: anything else throws, so it cannot be
 * reused to smuggle a different script past the directive.
 */
type ScriptUrlPolicy = {
  createScriptURL: (value: string) => string;
};

type TrustedTypesWindow = Window & {
  trustedTypes?: {
    createPolicy: (
      name: string,
      rules: { createScriptURL: (value: string) => string },
    ) => ScriptUrlPolicy;
  };
};

const POLICY_NAME = "pocketdesk-service-worker";
let cachedPolicy: ScriptUrlPolicy | null | undefined;

function getPolicy(expectedPath: string) {
  // createPolicy throws if the same name is created twice, and React's strict
  // double-invoke would do exactly that.
  if (cachedPolicy !== undefined) return cachedPolicy;

  const trustedTypes = (window as TrustedTypesWindow).trustedTypes;
  if (!trustedTypes) {
    cachedPolicy = null;
    return cachedPolicy;
  }

  cachedPolicy = trustedTypes.createPolicy(POLICY_NAME, {
    createScriptURL: (value) => {
      const resolved = new URL(value, window.location.origin);
      if (resolved.origin !== window.location.origin) {
        throw new Error("서비스 워커는 같은 오리진에서만 등록할 수 있습니다.");
      }
      if (resolved.pathname !== expectedPath) {
        throw new Error("서비스 워커 경로가 예상과 다릅니다.");
      }
      return resolved.href;
    },
  });
  return cachedPolicy;
}

/**
 * The URL to pass to `register()`. Returns the plain href where Trusted Types is
 * unavailable, which is the same value the policy would produce.
 */
export function toTrustedServiceWorkerUrl(url: URL): string {
  const policy = getPolicy(url.pathname);
  return policy ? policy.createScriptURL(url.href) : url.href;
}
