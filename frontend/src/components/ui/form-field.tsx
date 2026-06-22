import { type FormikProps } from 'formik';
import { type ReactNode } from 'react';
import { Field, FieldError, FieldLabel } from './field';
import { Input } from './input';

interface FormFieldProps<Values> {
  formik: FormikProps<Values>;
  name: keyof Values & string;
  label: string;
  type?: string;
  disabled?: boolean;
  /** Override the controlled value (defaults to the formik value). */
  value?: string | number;
  /** Extra classes for the field wrapper (e.g. `flex-1` inside a row). */
  className?: string;
  /** Override the default touched + error validity (e.g. server errors). */
  invalid?: boolean;
  /** Override the default error message (defaults to the formik error). */
  message?: ReactNode;
}

/**
 * A formik-bound shadcn <Field /> with a labelled <Input /> and an inline
 * validation message. Wraps the Label / Input / error trio every text field
 * repeats.
 */
export const FormField = <Values,>({
  formik,
  name,
  label,
  type = 'text',
  disabled,
  value,
  className,
  invalid,
  message,
}: FormFieldProps<Values>): ReactNode => {
  const show =
    invalid ?? (formik.errors[name] != null && formik.touched[name] === true);

  return (
    <Field data-invalid={show} className={className}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        name={name}
        disabled={disabled}
        value={value ?? (formik.values[name] as string | number)}
        aria-invalid={show}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
      />
      {show ? (
        <FieldError>{message ?? (formik.errors[name] as ReactNode)}</FieldError>
      ) : null}
    </Field>
  );
};
