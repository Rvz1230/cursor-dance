import { useEffect, useMemo, useState } from "react";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";
import {
  applicationFromSnapshot,
  rememberApplication,
  type ApplicationCandidate,
} from "./appRulesModel";

function matchesApplication(
  application: ApplicationCandidate,
  candidate: ApplicationCandidate,
): boolean {
  return Boolean(
    (application.bundleId && candidate.bundleId === application.bundleId)
    || candidate.processName.toLocaleLowerCase() === application.processName.toLocaleLowerCase(),
  );
}

export function mergeApplicationMetadata(
  application: ApplicationCandidate,
  installedApplications: readonly ApplicationCandidate[],
): ApplicationCandidate {
  const installed = installedApplications.find((candidate) => (
    matchesApplication(application, candidate)
  ));
  return installed ? {
    ...application,
    bundleId: application.bundleId || installed.bundleId,
    iconDataUrl: installed.iconDataUrl,
  } : application;
}

export function combineApplicationCatalog(
  recentApplications: readonly ApplicationCandidate[],
  installedApplications: readonly ApplicationCandidate[],
): ApplicationCandidate[] {
  return [
    ...recentApplications,
    ...installedApplications.filter((candidate) => (
      !recentApplications.some((recent) => (
        recent.processName.toLocaleLowerCase() === candidate.processName.toLocaleLowerCase()
      ))
    )),
  ];
}

export function useApplicationCatalog(activeApp: ActiveWindowSnapshot | null): {
  activeApplication: ApplicationCandidate | null;
  allApplications: ApplicationCandidate[];
  enrichedRecentApplications: ApplicationCandidate[];
  installedApplications: ApplicationCandidate[];
  installedLoading: boolean;
} {
  const [recentApplications, setRecentApplications] = useState<ApplicationCandidate[]>([]);
  const [installedApplications, setInstalledApplications] = useState<ApplicationCandidate[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  useEffect(() => {
    setRecentApplications((current) => rememberApplication(current, activeApp));
  }, [activeApp]);

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.cursorDanceApp : undefined;
    if (!bridge) return undefined;
    let cancelled = false;
    setInstalledLoading(true);
    void bridge.listInstalledApplications().then((applications) => {
      if (cancelled) return;
      setInstalledApplications(applications.map((application) => ({
        ...application,
        key: (application.bundleId || application.processName).toLocaleLowerCase(),
        title: "",
      })));
    }).catch(() => {
      if (!cancelled) setInstalledApplications([]);
    }).finally(() => {
      if (!cancelled) setInstalledLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const enrichedRecentApplications = useMemo(
    () => recentApplications.map((application) => (
      mergeApplicationMetadata(application, installedApplications)
    )),
    [installedApplications, recentApplications],
  );
  const activeApplication = useMemo(() => {
    const application = applicationFromSnapshot(activeApp);
    return application
      ? mergeApplicationMetadata(application, installedApplications)
      : null;
  }, [activeApp, installedApplications]);
  const allApplications = useMemo(
    () => combineApplicationCatalog(enrichedRecentApplications, installedApplications),
    [enrichedRecentApplications, installedApplications],
  );

  return {
    activeApplication,
    allApplications,
    enrichedRecentApplications,
    installedApplications,
    installedLoading,
  };
}
