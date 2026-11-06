import { renderSize } from './haze-motion';

export const vertexSource = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

export const fragmentSource = `precision highp float;
uniform vec2 uRes;uniform vec2 uPointer;uniform float uTime;
const vec3 bg=vec3(.110,.110,.110);const vec3 glow=vec3(.043,.251,.212);const vec3 strong=vec3(.149,.322,.294);const vec3 accent=vec3(.239,.812,.714);
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){v+=a*noise(p);p=r*p*2.02+7.;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/uRes;float s=min(uRes.x,uRes.y);vec2 p=(gl_FragCoord.xy-.5*uRes)/s;vec2 m=(uPointer-.5)*uRes/s;
float d=length(p-m);float pull=exp(-d*d*4.5);float t=uTime*.001;
vec2 q=vec2(fbm(p*1.05+t*.05),fbm(p*1.05+vec2(5.2,1.3)-t*.04));p+=(p-m)*pull*-.45;
float n=fbm(p*1.25+q*1.7+t*.03);float haze=smoothstep(.3,.72,n);
vec3 col=mix(bg,glow,haze*mix(.5,1.,uv.x));col=mix(col,strong,smoothstep(.5,.78,n)*.65);col=mix(col,glow,pull*.55);col=mix(col,strong,pull*pull*.45);col+=accent*pull*pull*.03;
col=min(col,vec3(.12,.33,.29));col+=(hash(gl_FragCoord.xy+floor(t*12.))-.5)*.012;gl_FragColor=vec4(col,1.);}`;

export interface Point {
  x: number;
  y: number;
}

/** Draws one picture of the haze at this time, with its light at this viewport position. */
export type Painter = (time: number, light: Point) => void;

interface Uniforms {
  res: WebGLUniformLocation | null;
  pointer: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
}

/** Returns null if this browser or GPU cannot run the shader; the static layer stays then. */
export function createPainter(canvas: HTMLCanvasElement): Painter | null {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: true,
  });
  const program = gl && linkProgram(gl);
  if (!gl || !program) return null;
  gl.useProgram(program);
  coverScreen(gl, program);
  const uniforms = readUniforms(gl, program);
  return (time, light) => paint(gl, uniforms, time, light);
}

function linkProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!program || !vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

// One triangle larger than the screen, so there is no seam along a diagonal.
function coverScreen(gl: WebGLRenderingContext, program: WebGLProgram): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
}

function readUniforms(gl: WebGLRenderingContext, program: WebGLProgram): Uniforms {
  return {
    res: gl.getUniformLocation(program, 'uRes'),
    pointer: gl.getUniformLocation(program, 'uPointer'),
    time: gl.getUniformLocation(program, 'uTime'),
  };
}

function paint(gl: WebGLRenderingContext, uniforms: Uniforms, time: number, light: Point): void {
  const { width, height } = renderSize(innerWidth, innerHeight, devicePixelRatio);
  if (gl.canvas.width !== width || gl.canvas.height !== height) {
    gl.canvas.width = width;
    gl.canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
  gl.uniform2f(uniforms.res, width, height);
  gl.uniform2f(uniforms.pointer, light.x / innerWidth, 1 - light.y / innerHeight);
  gl.uniform1f(uniforms.time, time);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
