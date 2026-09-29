export type TutorialStage = 'welcome' | 'roll' | 'move' | 'encounter' | 'card' | 'combat' | 'result' | 'done';
export type TutorialState = { stage: TutorialStage; selected: boolean; weapon: 'axe' | 'none'; pos: number; bonus: number };
export type TutorialAction = { type: 'start' | 'roll' | 'preview' | 'move' | 'draw' | 'prepare' | 'fight' | 'end' | 'restart' } | { type: 'weapon'; weapon: 'axe' | 'none' };
export function initialTutorial(): TutorialState { return { stage: 'welcome', selected: false, weapon: 'axe', pos: 0, bonus: 2 }; }
// This small, scripted example has no room, player session, network, or random state.
export function tutorialStep(state: TutorialState, action: TutorialAction): TutorialState {
  if (action.type === 'restart') return initialTutorial();
  switch (state.stage) {
    case 'welcome': return action.type === 'start' ? { ...state, stage: 'roll' } : state;
    case 'roll': return action.type === 'roll' ? { ...state, stage: 'move' } : state;
    case 'move':
      if (action.type === 'preview') return { ...state, selected: true };
      return action.type === 'move' && state.selected ? { ...state, stage: 'encounter', pos: 3 } : state;
    case 'encounter': return action.type === 'draw' ? { ...state, stage: 'card' } : state;
    case 'card': return action.type === 'prepare' ? { ...state, stage: 'combat' } : state;
    case 'combat':
      if (action.type === 'weapon') return { ...state, weapon: action.weapon };
      return action.type === 'fight' ? { ...state, stage: 'result', bonus: 3 } : state;
    case 'result': return action.type === 'end' ? { ...state, stage: 'done' } : state;
    default: return state;
  }
}
export function tutorialPhase(stage: TutorialStage) {
  return ['welcome','roll'].includes(stage) ? 0 : stage === 'move' ? 1 : ['encounter','card','combat'].includes(stage) ? 2 : 3;
}
