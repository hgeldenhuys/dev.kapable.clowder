"use client";

import { useMemo } from "react";
import { ShaderCanvas, type ShaderUniform } from "./ShaderCanvas";
import type { OrbData } from "../orbs/types";

/**
 * Multi-orb aurora visualizer — one ShaderCanvas per expert.
 * Active orb scales up to foreground; others shrink to background.
 */

interface MultiOrbVisualizerProps {
  orbs: OrbData[];
  activeOrbId?: string;
  onOrbClick?: (orbId: string) => void;
  isWaitingForExpert?: boolean;
}

// Distinct base hues per orb index (spread across color wheel)
const ORB_HUES: [number, number, number][] = [
  [0.12, 0.84, 0.98], // cyan
  [0.67, 0.42, 0.98], // violet
  [0.98, 0.56, 0.12], // amber
  [0.13, 0.77, 0.37], // green
  [0.96, 0.26, 0.48], // rose
];

function getOrbColor(orb: OrbData, index: number): [number, number, number] {
  if (orb.status === "building") return [0.23, 0.51, 0.96];
  if (orb.status === "done") return [0.13, 0.77, 0.37];
  return ORB_HUES[index % ORB_HUES.length];
}

function getOrbShaderParams(orb: OrbData, index: number, isActive: boolean, isWaiting: boolean) {
  const color = getOrbColor(orb, index);

  if (isActive && isWaiting) {
    // Thinking — fast pulse
    return {
      speed: 30, amplitude: 0.5, frequency: 1.0, scale: 0.3,
      brightness: 2.0, blur: 0.2, colorShift: 0.1, bloom: 0.8, color,
    };
  }
  if (isActive) {
    // Active expert — energetic
    return {
      speed: 20, amplitude: 1.0, frequency: 0.7, scale: 0.3,
      brightness: 1.5, blur: 0.2, colorShift: 0.05, bloom: 0.6, color,
    };
  }
  // Background orb — gentle idle but still visible
  return {
    speed: 10, amplitude: 1.0, frequency: 0.4, scale: 0.25,
    brightness: 1.2, blur: 0.2, colorShift: 0.05, bloom: 0.5, color,
  };
}

// Same aurora shader from AuraVisualizer
const AURA_SHADER = `
const float TAU = 6.283185;

vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float sdCircle(vec2 st, float r) {
  return length(st) - r;
}

vec2 turb(vec2 pos, float t, float it) {
  mat2 rotation = mat2(0.6, -0.25, 0.25, 0.9);
  mat2 layerRotation = mat2(0.6, -0.8, 0.8, 0.6);
  float frequency = mix(2.0, 15.0, uFrequency);
  float amplitude = uAmplitude;
  float frequencyGrowth = 1.4;
  float animTime = t * 0.1 * uSpeed;

  const int LAYERS = 4;
  for(int i = 0; i < LAYERS; i++) {
    vec2 rotatedPos = pos * rotation;
    vec2 wave = sin(frequency * rotatedPos + float(i) * animTime + it);
    pos += (amplitude / frequency) * rotation[0] * wave;
    rotation *= layerRotation;
    amplitude *= mix(1.0, max(wave.x, wave.y), uVariance);
    frequency *= frequencyGrowth;
  }
  return pos;
}

const float ITERATIONS = 36.0;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 pp = vec3(0.0);
  vec3 bloom = vec3(0.0);
  float t = iTime * 0.5;
  vec2 pos = uv - 0.5;

  vec2 prevPos = turb(pos, t, 0.0 - 1.0 / ITERATIONS);
  float spacing = mix(1.0, TAU, uSpacing);

  for(float i = 1.0; i < ITERATIONS + 1.0; i++) {
    float iter = i / ITERATIONS;
    vec2 st = turb(pos, t, iter * spacing);
    float d = abs(sdCircle(st, uScale));
    float pd = distance(st, prevPos);
    prevPos = st;
    float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;
    float ds = smoothstep(0.0, uBlur * 0.05 + max(dynamicBlur * uSmoothing, 0.001), d);

    vec3 color = uColor;
    if(uColorShift > 0.01) {
      vec3 hsv = rgb2hsv(color);
      hsv.x = fract(hsv.x + (1.0 - iter) * uColorShift * 0.3);
      color = hsv2rgb(hsv);
    }

    float invd = 1.0 / max(d + dynamicBlur, 0.001);
    pp += (ds - 1.0) * color;
    bloom += clamp(invd, 0.0, 250.0) * color;
  }

  pp *= 1.0 / ITERATIONS;

  bloom = bloom / (bloom + 2e4);
  vec3 color = (-pp + bloom * 3.0 * uBloom) * 1.2;
  color += (randFibo(fragCoord).x - 0.5) / 255.0;

  float brightness = length(color);
  vec3 direction = brightness > 0.0 ? color / brightness : color;
  float mapped = (brightness * 4.0) / (1.0 + brightness * 4.0);
  color = direction * mapped;

  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, 3.0);
  color = max(color, 0.0);

  float alpha = luma(color) * uMix;
  fragColor = vec4(color * uMix, alpha);
}`;

function OrbCanvas({
  orb,
  index,
  isActive,
  isWaiting,
  onClick,
}: {
  orb: OrbData;
  index: number;
  isActive: boolean;
  isWaiting: boolean;
  onClick: () => void;
}) {
  const params = getOrbShaderParams(orb, index, isActive, isWaiting);

  const uniforms = useMemo<Record<string, ShaderUniform>>(() => ({
    uSpeed: { type: "1f", value: params.speed },
    uBlur: { type: "1f", value: params.blur },
    uScale: { type: "1f", value: params.scale },
    uFrequency: { type: "1f", value: params.frequency },
    uAmplitude: { type: "1f", value: params.amplitude },
    uBloom: { type: "1f", value: params.bloom },
    uMix: { type: "1f", value: params.brightness },
    uSpacing: { type: "1f", value: 0.5 },
    uColorShift: { type: "1f", value: params.colorShift },
    uVariance: { type: "1f", value: 0.1 },
    uSmoothing: { type: "1f", value: 1.0 },
    uColor: { type: "3fv", value: params.color },
  }), [
    params.speed, params.blur, params.scale, params.frequency,
    params.amplitude, params.bloom, params.brightness,
    params.colorShift, params.color,
  ]);

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 transition-all duration-500 ease-out cursor-pointer"
      style={{
        transform: isActive ? "scale(1.0)" : "scale(0.7)",
        opacity: isActive ? 1 : 0.75,
        zIndex: isActive ? 10 : 1,
      }}
      aria-label={`${orb.name} — ${orb.status}${isActive ? " (selected)" : ""}`}
      aria-pressed={isActive}
    >
      <div
        className="rounded-full overflow-hidden w-[100px] h-[100px] sm:w-[140px] sm:h-[140px]"
        style={{
          boxShadow: isActive
            ? `0 0 30px rgba(${Math.round(params.color[0] * 255)}, ${Math.round(params.color[1] * 255)}, ${Math.round(params.color[2] * 255)}, 0.4)`
            : "none",
        }}
      >
        <ShaderCanvas
          fs={AURA_SHADER}
          uniforms={uniforms}
          devicePixelRatio={Math.min(globalThis.devicePixelRatio ?? 1, 1.5)}
          style={{ display: "block" }}
        />
      </div>
      <span
        className={`text-[10px] font-medium text-center transition-all ${
          isActive
            ? "text-foreground font-semibold"
            : "text-muted-foreground opacity-70"
        }`}
      >
        {orb.name}
      </span>
    </button>
  );
}

export function MultiOrbVisualizer({
  orbs,
  activeOrbId,
  onOrbClick,
  isWaitingForExpert,
}: MultiOrbVisualizerProps) {
  if (orbs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary/40 animate-pulse" />
          <p className="text-muted-foreground text-xs">
            Your AI experts will appear here as they join
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center gap-2 overflow-x-auto px-2">
      {orbs.map((orb, i) => (
        <OrbCanvas
          key={orb.id}
          orb={orb}
          index={i}
          isActive={orb.id === activeOrbId}
          isWaiting={orb.id === activeOrbId && !!isWaitingForExpert}
          onClick={() => onOrbClick?.(orb.id)}
        />
      ))}
    </div>
  );
}
