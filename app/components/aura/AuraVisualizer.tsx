"use client";

import { useMemo } from "react";
import { ShaderCanvas, type ShaderUniform } from "./ShaderCanvas";
import type { OrbData } from "../orbs/types";
import { getOrbHexColor } from "../orbs/types";

/**
 * Aura visualizer for the Clowder expert committee.
 *
 * Shader adapted from LiveKit's agent-starter-react (Polyform Non-Resale License).
 * Maps expert states to shader parameters for a glowing aurora effect.
 */

interface AuraVisualizerProps {
  orbs: OrbData[];
  activeOrbId?: string;
  onOrbClick?: (orbId: string) => void;
  isWaitingForExpert?: boolean;
}

function hexToRgb(hex: string): number[] {
  const m = hex.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (m) return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
  return [0.12, 0.84, 0.98]; // fallback cyan
}

function numToHex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}

/**
 * Map Clowder expert state to shader parameters.
 * Inspired by LiveKit's state machine but tuned for visual committee status.
 */
function getShaderParams(orbs: OrbData[], activeOrbId?: string, isWaiting?: boolean) {
  const activeOrb = orbs.find((o) => o.id === activeOrbId);

  // Standalone pixel test showed bloom is the key brightness driver:
  //   bloom=0.0 → ~2/255, bloom=0.2 → ~43/255, bloom=1.0 → ~150/255
  // uMix (brightness) is a linear multiplier on top.
  let speed = 10;
  let amplitude = 1.2;
  let frequency = 0.4;
  let scale = 0.2;
  let brightness = 1.5;
  let blur = 0.2;
  let colorShift = 0.05;
  let bloom = 0.6;
  let color = [0.12, 0.84, 0.98]; // cyan

  if (!activeOrb) {
    // Assembling — no active expert, gentle ambient pulse
    speed = 10;
    amplitude = 1.2;
    frequency = 0.4;
    scale = 0.2;
    brightness = 1.5;
    bloom = 0.5;
    colorShift = 0.15;
    color = [0.12, 0.5, 0.98]; // blue-cyan
    return { speed, amplitude, frequency, scale, brightness, blur, colorShift, bloom, color };
  }

  // Get color from expert state
  const hexColor = numToHex(getOrbHexColor(activeOrb.confidence, activeOrb.status));
  color = hexToRgb(hexColor);

  if (isWaiting) {
    // Expert is thinking — pulsing, faster
    speed = 30;
    amplitude = 0.5;
    frequency = 1.0;
    scale = 0.3;
    brightness = 2.0;
    bloom = 0.8;
    colorShift = 0.1;
  } else if (activeOrb.status === "on_stage") {
    // Active expert, responding — energetic
    speed = 20;
    amplitude = 1.0;
    frequency = 0.7;
    scale = 0.3;
    brightness = 1.5;
    bloom = 0.6;
    colorShift = 0.05;
  } else if (activeOrb.status === "building") {
    // Building — high energy
    speed = 70;
    amplitude = 0.75;
    frequency = 1.25;
    scale = 0.3;
    brightness = 2.0;
    bloom = 1.0;
    colorShift = 0.1;
  } else if (activeOrb.confidence >= 0.5) {
    // Progressing — steady glow
    speed = 15;
    amplitude = 0.8;
    frequency = 0.5;
    scale = 0.25;
    brightness = 1.5;
    bloom = 0.5;
    colorShift = 0.05;
  } else {
    // Unclear — dim, slow
    speed = 10;
    amplitude = 1.2;
    frequency = 0.4;
    scale = 0.2;
    brightness = 1.2;
    bloom = 0.4;
    colorShift = 0.05;
  }

  return { speed, amplitude, frequency, scale, brightness, blur, colorShift, bloom, color };
}

// The aurora shader — adapted from LiveKit/Unicorn Studio
const AURA_SHADER = `
const float TAU = 6.283185;

vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

vec3 Tonemap(vec3 x) {
  x *= 4.0;
  return x / (1.0 + x);
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

  // Dark mode — luminance-only tonemapping to preserve color
  bloom = bloom / (bloom + 2e4);
  vec3 color = (-pp + bloom * 3.0 * uBloom) * 1.2;
  color += (randFibo(fragCoord).x - 0.5) / 255.0;

  // Tonemap brightness only, preserve hue direction
  float brightness = length(color);
  vec3 direction = brightness > 0.0 ? color / brightness : color;
  float mapped = (brightness * 4.0) / (1.0 + brightness * 4.0);
  color = direction * mapped;

  // Boost saturation — bloom tends toward white
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(gray), color, 3.0);
  color = max(color, 0.0);

  float alpha = luma(color) * uMix;
  fragColor = vec4(color * uMix, alpha);
}`;

export function AuraVisualizer({
  orbs,
  activeOrbId,
  onOrbClick,
  isWaitingForExpert,
}: AuraVisualizerProps) {
  const params = getShaderParams(orbs, activeOrbId, isWaitingForExpert);

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

  if (orbs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">
          Assembling your expert committee...
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ShaderCanvas
        fs={AURA_SHADER}
        uniforms={uniforms}
        devicePixelRatio={Math.min(globalThis.devicePixelRatio ?? 1, 2)}
        style={{ display: "block" }}
      />

      {/* Expert labels overlay */}
      <div
        className="absolute bottom-1 left-1/2 flex justify-between pointer-events-none"
        style={{
          transform: "translateX(-50%)",
          width: `${Math.min(orbs.length * 120, 500)}px`,
        }}
      >
        {orbs.map((orb) => {
          const isActive = orb.id === activeOrbId;
          return (
            <button
              key={orb.id}
              onClick={() => onOrbClick?.(orb.id)}
              className={`text-[10px] font-medium text-center transition-all pointer-events-auto cursor-pointer hover:opacity-100 ${
                isActive
                  ? "text-white opacity-90 scale-110"
                  : "text-muted-foreground opacity-50 hover:text-white"
              }`}
              style={{ width: `${100 / orbs.length}%` }}
            >
              {orb.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
