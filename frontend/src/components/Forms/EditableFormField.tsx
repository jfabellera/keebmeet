import { type ReactNode } from 'react';
import {
  Box,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  type InputProps,
} from '@chakra-ui/react';

interface FieldDisplayProps extends InputProps {
  name: string;
  value: string | number | undefined;
  id: string;
  errorMessage: string | undefined;
  editable: boolean;
}

const EditableFormField = ({
  name,
  value,
  id,
  type,
  isInvalid,
  onChange,
  onBlur,
  errorMessage,
  editable,
  ...rest
}: FieldDisplayProps): ReactNode => {
  return (
    <Box paddingY={'0.5rem'} maxWidth={'sm'} {...rest}>
      <FormControl id={id} isInvalid={isInvalid} minWidth={0}>
        <FormLabel noOfLines={1} marginBottom={'0.2rem'}>
          {name}
        </FormLabel>
        {editable ? (
          <>
            <Input
              type={type}
              name={id}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            />

            <FormErrorMessage justifyContent={'right'}>
              {errorMessage}
            </FormErrorMessage>
          </>
        ) : (
          <Text textColor={'blackAlpha.700'}>{value ?? 'N/A'}</Text>
        )}
      </FormControl>
    </Box>
  );
};

export default EditableFormField;
