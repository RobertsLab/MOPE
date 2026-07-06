/** A small static illustrative pathway diagram for the landing page. */
export function MockPathway() {
  const nodes = [
    { x: 60, y: 60, label: 'NFE2L2', fill: '#e6550d' },
    { x: 180, y: 45, label: 'KEAP1', fill: '#6baed6' },
    { x: 300, y: 70, label: 'HMOX1', fill: '#a63603' },
    { x: 90, y: 160, label: 'SOD2', fill: '#fd8d3c' },
    { x: 210, y: 175, label: 'CAT', fill: '#9ca3af' },
    { x: 320, y: 165, label: 'GPX1', fill: '#2171b5' },
    { x: 160, y: 250, label: 'GSH', fill: '#d94801', shape: 'metabolite' },
  ];
  const edges = [
    [0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [2, 5], [3, 6], [5, 6],
  ];
  return (
    <svg viewBox="0 0 380 300" className="w-full">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="#cbd5e1" strokeWidth={2} />
      ))}
      {nodes.map((n) => (
        <g key={n.label}>
          {n.shape === 'metabolite' ? (
            <circle cx={n.x} cy={n.y} r={20} fill={n.fill} stroke="#1e293b" strokeWidth={2} />
          ) : (
            <rect x={n.x - 30} y={n.y - 16} width={60} height={32} rx={6} fill={n.fill} stroke="#1e293b" strokeWidth={2} />
          )}
          <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff" style={{ paintOrder: 'stroke' }} stroke="#00000055" strokeWidth={0.5}>
            {n.label}
          </text>
        </g>
      ))}
      <text x={10} y={292} fontSize={10} fill="#94a3b8">Warm = up · Cool = down · Gray = n.s.</text>
    </svg>
  );
}
