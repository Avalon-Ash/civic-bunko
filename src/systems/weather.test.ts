import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER } from '../core/constants/weather';
import { createTestWorld } from '../testing/fixture';
import { dispatch } from '../core/commands';
import { weatherOn, weatherPlace } from '../selectors/weather';
import { WEATHER_PLACES } from '../core/constants/weather';
import { importProgress, exportProgress } from './persistence';
import { createWorld } from '../core/world';
import { coarseCoord, parseWeather, weatherKind, weatherUrl } from './weather';

describe('weather sky', () => {
  it('maps WMO codes to three kinds of sky', () => {
    assert.equal(weatherKind(0), 'clear');
    assert.equal(weatherKind(1), 'clear');
    assert.equal(weatherKind(2), 'cloudy');
    assert.equal(weatherKind(3), 'cloudy');
    assert.equal(weatherKind(45), 'cloudy');
    for (const code of [51, 61, 65, 71, 80, 95, 99]) assert.equal(weatherKind(code), 'rain', String(code));
    for (const bad of [-1, 100, Number.NaN, '3', null, undefined]) assert.equal(weatherKind(bad), null);
  });

  it('only ever sends coarse coordinates', () => {
    assert.equal(coarseCoord(25.03396), 25);
    assert.equal(coarseCoord(121.56447), 121.6);
    const url = weatherUrl(25.03396, 121.56447);
    assert.ok(url?.startsWith(`${WEATHER.endpoint}?`));
    const query = new URL(url ?? '').searchParams;
    assert.equal(query.get('latitude'), '25');
    assert.equal(query.get('longitude'), '121.6');
    assert.ok(!url?.includes('03396') && !url?.includes('56447'));
    assert.equal(weatherUrl(Number.NaN, 121), null);
    assert.equal(weatherUrl(95, 121), null);
  });

  it('reads the service response, and gives nothing when the shape is wrong', () => {
    assert.deepEqual(parseWeather({ current: { weather_code: 3, is_day: 0 } }), { kind: 'cloudy', day: false });
    assert.deepEqual(parseWeather({ current: { weather_code: 0, is_day: 1 } }), { kind: 'clear', day: true });
    assert.deepEqual(parseWeather({ current: { weather_code: 63 } }), { kind: 'rain', day: true });
    for (const bad of [null, 'x', {}, { current: null }, { current: { weather_code: 'rain' } }]) assert.equal(parseWeather(bad), null);
  });

  it('is off until she turns it on, and the choice is saved on this device', () => {
    const world = createTestWorld();
    assert.equal(weatherOn(world), false);
    assert.equal('weather' in world.settings, false);
    dispatch(world, { type: 'setWeather', on: true });
    assert.equal(weatherOn(world), true);
    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.equal(weatherOn(other), true);
    dispatch(world, { type: 'setWeather', on: false });
    assert.equal(weatherOn(world), false);
  });

  it('can use a chosen place instead of the device location; unknown ids fall back to location', () => {
    const world = createTestWorld();
    assert.equal(weatherPlace(world), null);
    dispatch(world, { type: 'setWeatherPlace', place: 'taichung' });
    assert.equal(weatherPlace(world)?.name, '臺中市');
    const other = createWorld();
    assert.deepEqual(importProgress(other, exportProgress(world)), { ok: true });
    assert.equal(weatherPlace(other)?.id, 'taichung');
    dispatch(world, { type: 'setWeatherPlace', place: 'atlantis' });
    assert.equal(weatherPlace(world), null);
    assert.equal('weatherPlace' in world.settings, false);
    dispatch(world, { type: 'setWeatherPlace', place: 'taipei' });
    dispatch(world, { type: 'setWeatherPlace', place: null });
    assert.equal('weatherPlace' in world.settings, false);
    // 每個地點的座標都已經是粗略值、問得出網址，id 不重複
    assert.equal(new Set(WEATHER_PLACES.map((p) => p.id)).size, WEATHER_PLACES.length);
    for (const place of WEATHER_PLACES) {
      assert.equal(coarseCoord(place.latitude), place.latitude, place.name);
      assert.equal(coarseCoord(place.longitude), place.longitude, place.name);
      assert.ok(weatherUrl(place.latitude, place.longitude), place.name);
    }
  });
});
