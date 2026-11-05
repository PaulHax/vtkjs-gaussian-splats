import vtkRenderPass, {
  type vtkRenderPass as RenderPass,
} from "@kitware/vtk.js/Rendering/SceneGraph/RenderPass";

/** Plain alpha composition for a single actor whose splats are already sorted. */
export const createAlphaPass = (getContext: () => WebGL2RenderingContext) => {
  const pass = {} as RenderPass & { getShaderReplacement(): null };
  vtkRenderPass.extend(pass, {});
  pass.getShaderReplacement = () => null;
  pass.traverse = (_viewNode, rendererNode): void => {
    const gl = getContext();
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    pass.setCurrentOperation("translucentPass");
    try {
      rendererNode.traverse(pass);
    } finally {
      gl.depthMask(true);
    }
  };
  return Object.freeze(pass);
};
