
import { useEffect, useRef } from 'react';
import { useEditor } from '../store';

type Props = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  elementId?: string;
  disabled?: boolean;
};

const SLIDER_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

export function HistorySlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  elementId,
  disabled = false,
}: Props) {
  const activeRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);

  // 連続操作を1件の編集履歴にまとめる
  const begin = () => {
    if (!elementId || disabled) return;

    if (activeRef.current) {
      if (activeIdRef.current === elementId) return;

      useEditor.getState().endHistoryGroup();
    }

    useEditor.getState().beginHistoryGroup(elementId);
    activeRef.current = true;
    activeIdRef.current = elementId;
  };

  const end = () => {
    if (!activeRef.current) return;

    activeRef.current = false;
    activeIdRef.current = null;
    useEditor.getState().endHistoryGroup();
  };

  // 操作途中で部品が消えた場合も履歴を確定
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        activeRef.current = false;
        activeIdRef.current = null;
        useEditor.getState().endHistoryGroup();
      }
    };
  }, []);

  return (
    <label className="slider">
      {label}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onPointerDown={begin}
        onPointerUp={end}
        onPointerCancel={end}
        onTouchStart={begin}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={begin}
        onMouseUp={end}
        onKeyDown={(event) => {
          if (SLIDER_KEYS.includes(event.key)) {
            begin();
          }
        }}
        onKeyUp={(event) => {
          if (SLIDER_KEYS.includes(event.key)) {
            end();
          }
        }}
        onBlur={end}
        onChange={(event) => {
          begin();
          onChange(Number(event.currentTarget.value));
        }}
      />
    </label>
  );
}
