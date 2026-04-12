'use client';

import { useEffect, useState, useCallback } from 'react';
import type { VRPlatform } from '@vr/core';
import type { RegisteredModule } from '@vr/module-sdk';

interface Props {
  platform: VRPlatform;
  onEnterVR?: () => Promise<void>;
}

/**
 * 2D shell overlay — module list, XR status, active module indicator.
 * Subscribes to platform state reactively.
 */
export function HubOverlay({ platform, onEnterVR }: Props) {
  const [modules, setModules] = useState<RegisteredModule[]>([]);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [xrStatus, setXrStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setModules(platform.modules.getAll());

    return platform.store.subscribe((state) => {
      setActiveModule(state.activeModule);
      setXrStatus(state.xrStatus as string);
      setIsLoading(state.isLoading);
    });
  }, [platform]);

  const handleActivate = useCallback(
    async (moduleId: string) => {
      if (activeModule && activeModule !== moduleId) {
        await platform.runtime.deactivateModule(activeModule);
      }
      await platform.runtime.activateModule(moduleId);
    },
    [platform, activeModule],
  );

  const handleEnterVR = useCallback(async () => {
    await onEnterVR?.();
  }, [onEnterVR]);

  return (
    <div style={styles.overlay}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>VR Platform</span>
        <div style={styles.statusRow}>
          {isLoading && <span style={styles.loading}>Carregando…</span>}
          <span style={styles.xrBadge}>{xrStatus}</span>
          <button style={styles.vrBtn} onClick={handleEnterVR}>
            Entrar em VR
          </button>
        </div>
      </div>

      {/* Module list */}
      <div style={styles.moduleList}>
        {modules.map((mod) => (
          <ModuleCard
            key={mod.manifest.id}
            mod={mod}
            isActive={activeModule === mod.manifest.id}
            onActivate={handleActivate}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  mod: RegisteredModule;
  isActive: boolean;
  onActivate: (id: string) => void;
}

function ModuleCard({ mod, isActive, onActivate }: CardProps) {
  const { id, name, type, description } = mod.manifest;
  const hasError = mod.status === 'error';

  return (
    <div
      style={{
        ...styles.card,
        borderColor: isActive ? '#7c6fcd' : hasError ? '#c0392b' : '#2a2a3a',
      }}
    >
      <div style={styles.cardHeader}>
        <strong style={styles.cardName}>{name}</strong>
        <span style={styles.cardType}>{type}</span>
      </div>
      {description && <p style={styles.cardDesc}>{description}</p>}
      <div style={styles.cardFooter}>
        <span style={styles.cardStatus}>{mod.status}</span>
        {!hasError && (
          <button
            style={styles.activateBtn}
            onClick={() => onActivate(id)}
            disabled={isActive}
          >
            {isActive ? 'Ativo' : 'Ativar'}
          </button>
        )}
        {hasError && <span style={styles.errorBadge}>Erro</span>}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'absolute' as const,
    inset: 0,
    pointerEvents: 'none' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(10,10,20,0.85)',
    borderRadius: '10px',
    padding: '10px 16px',
    pointerEvents: 'auto' as const,
    backdropFilter: 'blur(8px)',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#c8c3f0',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  loading: {
    fontSize: '0.75rem',
    color: '#ffd700',
    animation: 'pulse 1s infinite',
  },
  xrBadge: {
    fontSize: '0.7rem',
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  vrBtn: {
    background: '#5a4fcf',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  moduleList: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    pointerEvents: 'auto' as const,
  },
  card: {
    background: 'rgba(14,14,26,0.9)',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    padding: '12px 16px',
    width: '220px',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: '0.9rem',
    color: '#ddd',
  },
  cardType: {
    fontSize: '0.65rem',
    color: '#7c6fcd',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  cardDesc: {
    fontSize: '0.75rem',
    color: '#888',
    lineHeight: 1.4,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  cardStatus: {
    fontSize: '0.65rem',
    color: '#555',
    textTransform: 'uppercase' as const,
  },
  activateBtn: {
    background: '#2a2a4a',
    color: '#c8c3f0',
    border: '1px solid #5a4fcf',
    borderRadius: '5px',
    padding: '3px 10px',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  errorBadge: {
    fontSize: '0.7rem',
    color: '#e74c3c',
  },
} as const;
