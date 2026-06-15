"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { ChangeEvent, TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
};

const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function AutoResizeTextarea(
    { minRows = 3, onChange, style, ...props },
    ref
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const resizeToContent = () => {
      const element = innerRef.current;
      if (!element) return;

      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };

    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

    useEffect(() => {
      resizeToContent();
    }, [props.value, minRows]);

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      resizeToContent();
      onChange?.(event);
    };

    return (
      <textarea
        {...props}
        ref={innerRef}
        rows={minRows}
        onChange={handleChange}
        style={style}
      />
    );
  }
);

export default AutoResizeTextarea;