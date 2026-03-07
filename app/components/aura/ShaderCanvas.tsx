"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Minimal WebGL ShaderToy-compatible canvas renderer.
 *
 * Adapted from LiveKit's react-shader-toy (Polyform Non-Resale License).
 * Stripped to essentials: fragment shader + custom uniforms + iTime/iResolution.
 */

type UniformValue = number | number[];
type UniformType =
  | "1f" | "2f" | "3f" | "4f"
  | "1i" | "2i" | "3i" | "4i"
  | "1fv" | "2fv" | "3fv" | "4fv";

export interface ShaderUniform {
  type: UniformType;
  value: UniformValue;
}

export interface ShaderCanvasProps {
  fs: string;
  uniforms?: Record<string, ShaderUniform>;
  style?: CSSProperties;
  className?: string;
  devicePixelRatio?: number;
}

const BASIC_VS = `attribute vec3 aVertexPosition;
void main(void) {
    gl_Position = vec4(aVertexPosition, 1.0);
}`;

const FS_MAIN_SHADER = `\nvoid main(void){
    vec4 color = vec4(0.0,0.0,0.0,1.0);
    mainImage( color, gl_FragCoord.xy );
    gl_FragColor = color;
}`;

const uniformTypeToGLSL: Record<string, string> = {
  "1f": "float", "2f": "vec2", "3f": "vec3", "4f": "vec4",
  "1i": "int", "2i": "ivec2", "3i": "ivec3", "4i": "ivec4",
  "1fv": "float", "2fv": "vec2", "3fv": "vec3", "4fv": "vec4",
};

function setUniform(
  gl: WebGLRenderingContext,
  loc: WebGLUniformLocation,
  type: UniformType,
  value: UniformValue,
) {
  if (typeof value === "number") {
    if (type === "1i") gl.uniform1i(loc, value);
    else gl.uniform1f(loc, value);
    return;
  }
  switch (type) {
    case "2f": gl.uniform2f(loc, value[0], value[1]); break;
    case "3f": gl.uniform3f(loc, value[0], value[1], value[2]); break;
    case "4f": gl.uniform4f(loc, value[0], value[1], value[2], value[3]); break;
    case "1fv": gl.uniform1fv(loc, value); break;
    case "2fv": gl.uniform2fv(loc, value); break;
    case "3fv": gl.uniform3fv(loc, value); break;
    case "4fv": gl.uniform4fv(loc, value); break;
    default: break;
  }
}

interface GLState {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  buf: WebGLBuffer;
  posAttr: number;
  customNames: string[];
  builtins: Record<string, { glsl: string; needed: boolean }>;
  animId: number;
  timer: number;
  lastTime: number;
  ro: ResizeObserver;
}

export function ShaderCanvas({
  fs,
  uniforms: propUniforms,
  style,
  className,
  devicePixelRatio: dpr = 1,
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniformsRef = useRef(propUniforms);
  const glStateRef = useRef<GLState | null>(null);

  // Keep uniforms ref in sync so animation loop picks up latest values
  useEffect(() => {
    uniformsRef.current = propUniforms;
  }, [propUniforms]);

  useEffect(() => {
    // Guard: only initialize once per canvas element
    if (glStateRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: true,
    }) as WebGLRenderingContext | null;
    if (!gl) return;

    gl.getExtension("OES_standard_derivatives");
    gl.clearColor(0, 0, 0, 0);

    // Buffers
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0]),
      gl.STATIC_DRAW,
    );

    // Build built-in uniform declarations
    const builtins: Record<string, { glsl: string; needed: boolean }> = {
      iTime: { glsl: "float", needed: false },
      iResolution: { glsl: "vec2", needed: false },
    };

    // Detect which built-ins and custom uniforms the shader uses
    let fragSrc = `precision highp float;\n`;
    const customNames: string[] = [];

    for (const [name, info] of Object.entries(builtins)) {
      if (fs.includes(name)) {
        fragSrc += `uniform ${info.glsl} ${name};\n`;
        info.needed = true;
      }
    }

    if (uniformsRef.current) {
      for (const [name, u] of Object.entries(uniformsRef.current)) {
        if (fs.includes(name)) {
          const glsl = uniformTypeToGLSL[u.type];
          if (glsl) {
            fragSrc += `uniform ${glsl} ${name};\n`;
            customNames.push(name);
          }
        }
      }
    }

    fragSrc += fs;
    if (fs.includes("mainImage")) fragSrc += FS_MAIN_SHADER;

    // Compile shaders
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        console.error("Shader compile:", gl!.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, BASIC_VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("ShaderCanvas link error:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const posAttr = gl.getAttribLocation(prog, "aVertexPosition");
    gl.enableVertexAttribArray(posAttr);

    // Resize handler
    function resize() {
      if (!canvas || !gl) return;
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      canvas.width = w;
      canvas.height = h;
      if (builtins.iResolution.needed) {
        gl.useProgram(prog);
        const loc = gl.getUniformLocation(prog, "iResolution");
        gl.uniform2fv(loc, [w, h]);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Store state
    const state: GLState = {
      gl, prog, buf, posAttr, customNames, builtins,
      animId: 0, timer: 0, lastTime: 0, ro,
    };
    glStateRef.current = state;

    // Animation loop
    function draw(timestamp: number) {
      const s = glStateRef.current;
      if (!s) return;
      const { gl, prog, buf, posAttr, customNames, builtins } = s;

      const delta = s.lastTime ? (timestamp - s.lastTime) / 1000 : 0;
      s.lastTime = timestamp;
      s.timer += delta;

      // Ensure this program is active (guards against stale GL state)
      gl.useProgram(prog);

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 0, 0);

      // Built-in uniforms
      if (builtins.iTime.needed) {
        gl.uniform1f(gl.getUniformLocation(prog, "iTime"), s.timer);
      }

      // Custom uniforms — read from ref for latest values
      const currentUniforms = uniformsRef.current;
      if (currentUniforms) {
        for (const name of customNames) {
          const u = currentUniforms[name];
          if (!u) continue;
          const loc = gl.getUniformLocation(prog, name);
          if (loc) setUniform(gl, loc, u.type, u.value);
        }
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      s.animId = requestAnimationFrame(draw);
    }

    state.animId = requestAnimationFrame(draw);

    return () => {
      if (glStateRef.current) {
        cancelAnimationFrame(glStateRef.current.animId);
        glStateRef.current.ro.disconnect();
        glStateRef.current = null;
      }
    };
  }, [fs, dpr]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
