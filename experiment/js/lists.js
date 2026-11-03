// Counterbalancing: item-level Latin square over 4 lists.
// Within each offer type, scenario i goes to cell (i + list) % 4, so each list has
// exactly 4 trials per (type x cell) and across the 4 lists every scenario appears in every cell.
const Lists = (() => {
  const CELLS = [
    { frame: "gain", urgency: "high" },
    { frame: "gain", urgency: "low" },
    { frame: "loss", urgency: "high" },
    { frame: "loss", urgency: "low" },
  ];
  const N_LISTS = 4;

  function build(stim, list) {
    const out = [];
    for (const type of ["scam", "legit"]) {
      stim.scenarios
        .filter((s) => s.type === type)
        .forEach((sc, i) => {
          const c = CELLS[(i + list) % 4];
          out.push({ sc, frame: c.frame, urgency: c.urgency, cell: `${c.frame}_${c.urgency}` });
        });
    }
    return out;
  }

  /** Sanity check used in debug mode: every list balanced. Throws on failure. */
  function check(stim) {
    for (let L = 0; L < N_LISTS; L++) {
      const counts = {};
      build(stim, L).forEach((t) => {
        const k = `${t.sc.type}/${t.cell}`;
        counts[k] = (counts[k] || 0) + 1;
      });
      const vals = Object.values(counts);
      if (vals.length !== 8 || vals.some((v) => v !== 4)) throw new Error(`List ${L} unbalanced: ${JSON.stringify(counts)}`);
    }
    return true;
  }

  return { build, check, CELLS, N_LISTS };
})();
