import React from "react";
import {
  getBezierPath,
  getEdgeCenter
} from "react-flow-renderer";

import "./css/buttonedge.css";

export default function removeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEndId
}) {
  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const markerEnd = markerEndId ? `url(#${markerEndId})` : null;

  const [edgeCenterX, edgeCenterY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  const mergedStyle = {
    stroke: "rgba(100,116,139,0.72)",
    strokeWidth: 2.6,
    strokeDasharray: "8 8",
    strokeLinecap: "round",
    ...style
  };

  return (
    <>
      <path
        id={id}
        style={mergedStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      <foreignObject
        width={20}
        height={20}
        x={edgeCenterX - 10}
        y={edgeCenterY - 10}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <body style={{ margin: 0, background: "transparent" }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              margin: "6px auto",
              background: "rgba(124,58,237,0.22)",
              boxShadow: "0 0 0 4px rgba(124,58,237,0.08)"
            }}
          />
        </body>
      </foreignObject>
    </>
  );
}
