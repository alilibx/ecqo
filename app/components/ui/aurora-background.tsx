import React, { type ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={`aurora-bg ${className || ""}`}
      {...props}
    >
      <div className="aurora-overflow">
        <div
          className={`aurora-inner ${showRadialGradient ? "aurora-radial-mask" : ""}`}
        />
      </div>
      {children}
    </div>
  );
};
