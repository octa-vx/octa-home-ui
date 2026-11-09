import { registerPrimitives } from '@octa/primitives';
import { airWidget } from './air.ts';
import { applianceWidget } from './appliance.ts';
import { OctaAlarmPanel } from './alarm-panel.ts';
import { OctaCameraImage } from './camera-image.ts';
import { cameraWidget } from './camera.ts';
import { registerWidget } from './card.ts';
import { climateWidget } from './climate.ts';
import { coverWidget } from './cover.ts';
import { energyWidget } from './energy.ts';
import { lightWidget } from './light.ts';
import { inputWidget } from './input.ts';
import { mediaWidget } from './media.ts';
import { sceneWidget } from './scene.ts';
import { securityWidget } from './security.ts';
import { sensorWidget } from './sensor.ts';
import { switchWidget } from './switch.ts';
import { systemWidget } from './system.ts';
import { contactsWidget } from './contacts.ts';
import { roomWidget } from './room.ts';
import { OctaTimerDisplay } from './timer-display.ts';
import { weatherWidget } from './weather.ts';

export { icon, type IconName } from './icons.ts';

/** Every card with its specification, for example to validate generated configurations. */
export const widgets = [lightWidget, climateWidget, coverWidget, switchWidget, sceneWidget, airWidget, sensorWidget, energyWidget, securityWidget, cameraWidget, mediaWidget, weatherWidget, systemWidget, applianceWidget, inputWidget, contactsWidget, roomWidget].map(({ element, spec }) => ({ element, spec }));

export function registerWidgets(): void {
  registerPrimitives();
  registerWidget(lightWidget);
  registerWidget(climateWidget);
  registerWidget(coverWidget);
  registerWidget(switchWidget);
  registerWidget(sceneWidget);
  registerWidget(airWidget);
  registerWidget(sensorWidget);
  registerWidget(energyWidget);
  if (!customElements.get('octa-alarm-panel')) customElements.define('octa-alarm-panel', OctaAlarmPanel);
  registerWidget(securityWidget);
  if (!customElements.get('octa-camera-image')) customElements.define('octa-camera-image', OctaCameraImage);
  registerWidget(cameraWidget);
  registerWidget(mediaWidget);
  registerWidget(weatherWidget);
  registerWidget(systemWidget);
  registerWidget(contactsWidget);
  registerWidget(roomWidget);
  registerWidget(applianceWidget);
  if (!customElements.get('octa-timer-display')) customElements.define('octa-timer-display', OctaTimerDisplay);
  registerWidget(inputWidget);
}
