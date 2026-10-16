import SuggestionInput from "components/SuggestionInput/SuggestionInput";

export const ValueInput = ({
  value,
  onChange,
  label,
  onBlur,
  className,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur?: () => void;
  label?: string;
  className?: string;
}) => {
  const onValueChange = (value: string) => {
    // Limit input length to prevent unreasonable values
    if (value.length > 10) return;
    const parsedValue = parseInt(value);

    if (isNaN(parsedValue)) {
      onChange(0);
    } else {
      onChange(parsedValue);
    }
  };

  return (
    <SuggestionInput
      label={label}
      className={className}
      value={value?.toString()}
      setValue={onValueChange}
      onBlur={onBlur}
    />
  );
};
