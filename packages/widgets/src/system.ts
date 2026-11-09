import { html, nothing, type TemplateResult } from 'lit';
import { normalizeEntity, translate, type HassPort, type MessageKey } from '@octa/ha-core';
import { defineWidget } from './define.ts';

export interface SystemRow {
  label: string;
  value: string;
  /** Traffic light for status values, `null` for plain readings. */
  ok: boolean | null;
}

export interface SystemViewModel {
  rows: SystemRow[];
}

export interface Container {
  name: string;
  status?: string;
  cpu?: string;
  memory?: string;
}

const METRICS: { role: string; label: MessageKey }[] = [
  { role: 'cpu', label: 'cpu' },
  { role: 'memory', label: 'memory' },
  { role: 'temperature', label: 'temperature' },
  { role: 'disk', label: 'disk' },
  { role: 'uptime', label: 'uptime' },
];

const PROBLEM_STATES = ['off', 'unavailable', 'unknown', 'dead', 'failed', 'stopped', 'exited'];

export function parseContainers(value: unknown): Container[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { name, status, cpu, memory } = item as Record<string, unknown>;
    if (typeof name !== 'string' || name === '') return [];
    return [{ name, ...(typeof status === 'string' ? { status } : {}), ...(typeof cpu === 'string' ? { cpu } : {}), ...(typeof memory === 'string' ? { memory } : {}) }];
  });
}

function reading(port: HassPort, id: string | undefined): string | null {
  if (!id) return null;
  const target = normalizeEntity(port, id);
  return target.status === 'missing' ? null : target.stateLabel;
}

function statusRow(port: HassPort, label: string, id: string): SystemRow | null {
  const target = normalizeEntity(port, id);
  if (target.status === 'missing') return null;
  return { label, value: target.stateLabel, ok: !PROBLEM_STATES.includes((target.entity?.state ?? '').toLowerCase()) };
}

function containerRows(port: HassPort, container: Container): SystemRow[] {
  const rows: SystemRow[] = [];
  const status = container.status ? statusRow(port, container.name, container.status) : null;
  if (status) rows.push(status);
  const details = [reading(port, container.cpu), reading(port, container.memory)].filter((value) => value !== null);
  if (details.length > 0) rows.push({ label: status ? '' : container.name, value: details.join(' · '), ok: null });
  return rows;
}

/** Read only by design: this card renders no controls and sends no commands, Docker included. */
function render(vm: SystemViewModel): TemplateResult {
  return html`<div class="stack tight">
    ${vm.rows.map(
      (row) => html`<div class="row body">
        <span class="muted-text">${row.label}</span>
        <strong class="with-icon">${row.ok === null ? nothing : html`<span class="status-dot ${row.ok ? 'ok' : 'bad'}"></span>`}${row.value}</strong>
      </div>`,
    )}
  </div>`;
}

export const systemWidget = defineWidget<SystemViewModel>({
  element: 'octa-system-card',
  name: 'Octa Home UI System',
  description: 'Server- und Systemwerte oder Docker-Status, nur Anzeige',
  spec: {
    variants: ['server_status', 'system_status', 'docker_status'],
    defaultVariant: 'server_status',
    roles: {
      main: { domains: ['binary_sensor', 'sensor'] },
      cpu: { domains: ['sensor'] },
      memory: { domains: ['sensor'] },
      temperature: { domains: ['sensor'] },
      disk: { domains: ['sensor'] },
      uptime: { domains: ['sensor'] },
    },
    extras: ['containers'],
  },
  editor: (german) => [
    {
      name: 'containers',
      selector: {
        object: {
          multiple: true,
          label_field: 'name',
          fields: {
            name: { label: 'Name', required: true, selector: { text: {} } },
            status: { label: 'Status', selector: { entity: {} } },
            cpu: { label: german ? 'Prozessor' : 'CPU', selector: { entity: { domain: ['sensor'] } } },
            memory: { label: german ? 'Arbeitsspeicher' : 'Memory', selector: { entity: { domain: ['sensor'] } } },
          },
        },
      },
    },
  ],
  columns: 12,
  // Without a status entity the card is a list of independent readings, one failing must not hide the others.
  aggregate: (config) => config.roles.main === undefined,
  defaultTitle: (language, variant) => translate(language, variant === 'docker_status' ? 'docker' : variant === 'system_status' ? 'system' : 'server'),
  watch: (config) => parseContainers(config.extras?.containers).flatMap((container) => [container.status, container.cpu, container.memory].filter((id): id is string => id !== undefined)),
  toViewModel(target, config, port) {
    const rows: SystemRow[] = [];
    if (config.roles.main) {
      const status = statusRow(port, translate(port.language, 'status'), config.roles.main);
      if (status) rows.push(status);
    }
    for (const { role, label } of METRICS) {
      const value = reading(port, config.roles[role]);
      if (value !== null) rows.push({ label: translate(port.language, label), value, ok: null });
    }
    if (config.variant === 'docker_status') rows.push(...parseContainers(config.extras?.containers).flatMap((container) => containerRows(port, container)));
    if (rows.length > 0) return { rows };
    return { rows: [config.roles.main === undefined ? { label: translate(port.language, 'no_data'), value: '', ok: null } : { label: target.name, value: target.stateLabel, ok: null }] };
  },
  render,
});
