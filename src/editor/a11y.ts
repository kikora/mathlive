import type { TextToSpeechOptions } from '../public/options';

import { Atom } from '../core/atom';

import type { ModelPrivate } from '../editor-model/model-private';
import type { MathfieldPrivate } from '../editor-mathfield/mathfield-private';
import { AnnounceVerb } from '../editor-model/utils';

import { speakableText } from './speech';

/* Kikora MODIFICATION: We have translated the text for aria-live when navigating in the expression */

/**
 * Given an atom, describe the relationship between the atom
 * and its siblings and their parent.
 */
function relationName(atom: Atom): string {
  let result: string | undefined = undefined;
  if (atom.treeBranch === 'body') {
    result = {
      enclose: 'krysse ut',
      leftright: 'skilletegn',
      surd: 'kvadratrot',
      root: 'mattefelt',
      mop: 'operatør', // E.g. `\operatorname`, a `mop` with a body
    }[atom.type];
  } else if (atom.parent!.type === 'genfrac') {
    if (atom.treeBranch === 'above') return 'teller';

    if (atom.treeBranch === 'below') return 'nevner';
  } else if (atom.parent!.type === 'surd') {
    if (atom.treeBranch === 'above') result = 'indeks';
  } else if (atom.treeBranch === 'superscript') result = 'opphøyd';
  else if (atom.treeBranch === 'subscript') result = 'opphøyd';

  if (!result) console.log('unknown relationship');

  return result ?? 'gruppe';
}

/**
 * Announce a change in selection or content via the aria-live region.
 *
 * @param action The action that invoked the change.
 * @param previousPosition The position of the insertion point before the change
 */
export function defaultAnnounceHook(
  mathfield: MathfieldPrivate,
  action: AnnounceVerb,
  previousPosition?: number,
  atoms?: Atom[]
): void {
  //* * Fix: the focus is the end of the selection, so it is before where we want it
  let liveText = '';
  // Const action = moveAmount > 0 ? "right" : "left";

  if (action === 'plonk') {
    // Use this sound to indicate minor errors, for
    // example when an action has no effect.
    mathfield.playSound('plonk');
    // As a side effect, reset the keystroke buffer
    mathfield.flushInlineShortcutBuffer();
  } else if (action === 'delete')
    liveText = speakableText(mathfield.options, 'slettet: ', atoms!);
  //* ** FIX: could also be moveUp or moveDown -- do something different like provide context???
  else if (action === 'focus' || action.includes('move')) {
    //* ** FIX -- should be xxx selected/unselected */
    liveText =
      getRelationshipAsSpokenText(mathfield.model, previousPosition) +
      (mathfield.model.selectionIsCollapsed ? '' : 'selected: ') +
      getNextAtomAsSpokenText(mathfield.model, mathfield.options);
  } else if (action === 'replacement') {
    // Announce the contents
    liveText = speakableText(
      mathfield.options,
      '',
      mathfield.model.at(mathfield.model.position)
    );
  } else if (action === 'line') {
    // Announce the current line -- currently that's everything
    // mathfield.accessibleNode.innerHTML = mathfield.options.createHTML(
    //     '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
    //         atomsToMathML(mathfield.model.root, mathfield.options) +
    //         '</math>'
    // );

    /* Kikora MODIFICATION: The content of the input filed is printed as both aria-live and label,
     * causing the screen reader to read it multiple times. We make it update just the label.
     * But, in order for it to read anything at all when focus we need the aria-live to change.
     * So keep the trick of swtiching the last space character, just with a empty liveText.
     * This will cause most screen readers to say "blank" at the end, but is the best compromised
     * I have found.
     */
    // liveText = speakableText(mathfield.options, '', mathfield.model.root);
    // mathfield.keyboardDelegate!.setAriaLabel(liveText);
    const label = speakableText(mathfield.options, '', mathfield.model.root);
    mathfield.keyboardDelegate!.setAriaLabel(label);

    /** * FIX -- testing hack for setting braille ***/
    // mathfield.accessibleNode.focus();
    // console.log("before sleep");
    // sleep(1000).then(() => {
    //     mathfield.textarea.focus();
    //     console.log("after sleep");
    // });
  } else {
    liveText = atoms
      ? speakableText(mathfield.options, action + ' ', atoms)
      : action;
  }

  // Aria-live regions are only spoken when it changes; force a change by
  // alternately using nonbreaking space or narrow nonbreaking space
  const ariaLiveChangeHack = mathfield.ariaLiveText.textContent!.includes(
    '\u00a0'
  )
    ? ' \u202F '
    : ' \u00A0 ';
  mathfield.ariaLiveText.textContent = liveText + ariaLiveChangeHack;
  // This.textarea.setAttribute('aria-label', liveText + ariaLiveChangeHack);
}

function getRelationshipAsSpokenText(
  model: ModelPrivate,
  previousOffset?: number
): string {
  if (Number.isNaN(previousOffset)) return '';
  const previous = model.at(previousOffset!);
  if (!previous) return '';
  if (previous.treeDepth <= model.at(model.position).treeDepth) return '';

  let result = '';
  let ancestor = previous.parent;
  const newParent = model.at(model.position).parent;
  while (ancestor !== model.root && ancestor !== newParent) {
    result += `ute av ${relationName(ancestor!)};`;
    ancestor = ancestor!.parent;
  }

  return result;
}

/**
 *
 * Return the spoken text for the atom to the right of the current selection.
 * Take into consideration the position amongst siblings to include 'start of'
 * and 'end of' if applicable.
 */
function getNextAtomAsSpokenText(
  model: ModelPrivate,
  options: TextToSpeechOptions
): string {
  if (!model.selectionIsCollapsed)
    return speakableText(options, '', model.getAtoms(model.selection));

  let result = '';

  // Announce start of denominator, etc
  const cursor = model.at(model.position);
  const relation = relationName(cursor);
  if (cursor.isFirstSibling)
    result = (relation ? 'start ' + relation : 'unknown') + ': ';

  if (cursor.isLastSibling) {
    // Don't say both start and end
    if (!cursor.isFirstSibling)
      result += relation ? 'slutt ' + relation : 'unknown';
  } else result += speakableText(options, '', cursor);

  return result;
}
