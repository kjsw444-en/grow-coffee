import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

const portalRoots = new Map<string, HTMLElement>();

export function getAppPortalRoot(rootId = 'app-portal-root'): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('document unavailable');
  }

  const existing = portalRoots.get(rootId) ?? document.getElementById(rootId);
  if (existing) {
    portalRoots.set(rootId, existing);
    return existing;
  }

  const root = document.createElement('div');
  root.id = rootId;
  document.body.append(root);
  portalRoots.set(rootId, root);
  return root;
}

type AppPortalProps = {
  children: ReactNode;
  rootId?: string;
};

export function AppPortal({ children, rootId = 'app-portal-root' }: AppPortalProps) {
  return createPortal(children, getAppPortalRoot(rootId));
}
