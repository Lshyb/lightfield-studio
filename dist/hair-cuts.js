export const hairCuts = {
  male: {
    none:{name:'原始短茬'},
    short:{name:'立体短发',source:'short',cut:[.06,1]},
    bob:{name:'自然中发',source:'bob',cut:[.06,.58]},
    curly:{name:'蓬松短卷',source:'curly',cut:[.12,.57]}
  },
  female: {
    none:{name:'无发对照'},
    short:{name:'柔顺短发',source:'bob',cut:[.08,.38]},
    bob:{name:'中长直发',source:'bob',cut:[.06,1]},
    curly:{name:'自然卷发',source:'curly',cut:[.12,1.08]}
  }
};
export function fitHairPoint(x,y,z,mobility,cut) {
  const t=Math.min(1,Math.max(0,mobility/.4)),w=t*t*(3-2*t);
  return [x,y+Math.max(0,cut[0]-y)*(1-cut[1])*w,z];
}
