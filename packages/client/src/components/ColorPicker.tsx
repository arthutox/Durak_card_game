import { PLAYER_COLORS } from '@durak/shared';
import type { PlayerColor } from '@durak/shared';
import { PLAYER_COLOR_HEX, PLAYER_COLOR_LABEL } from './playerColors';

interface ColorPickerProps {
  value: PlayerColor | null;
  taken: readonly PlayerColor[];
  onChange: (color: PlayerColor) => void;
}

/** Palette as a radio group: taken colors are disabled. */
export function ColorPicker({ value, taken, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Name color">
      {PLAYER_COLORS.map((color) => {
        const isTaken = taken.includes(color);
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={`${PLAYER_COLOR_LABEL[color]}${isTaken ? ' (taken)' : ''}`}
            disabled={isTaken}
            className={`swatch${value === color ? ' is-selected' : ''}`}
            style={{ background: PLAYER_COLOR_HEX[color] }}
            onClick={() => onChange(color)}
          />
        );
      })}
    </div>
  );
}
