import { type ReactNode } from 'react';
import {
  Box,
  Button,
  HStack,
  Heading,
  Spacer,
  type BoxProps,
} from '@chakra-ui/react';
import { FiEdit } from 'react-icons/fi';

interface MeetupDisplaySettingsProps extends BoxProps {
  title: string;
  isEditable: boolean;
  isSubmitLoading?: boolean;
  isFormInvalid?: boolean;
  onEditEnter: () => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
}

const EditableFormCard = ({
  title,
  isEditable,
  isSubmitLoading,
  isFormInvalid,
  onEditEnter,
  onEditSubmit,
  onEditCancel,
  children,
  ...rest
}: MeetupDisplaySettingsProps): ReactNode => {
  return (
    <Box
      background={'white'}
      borderRadius={'md'}
      boxShadow={'sm'}
      padding={{ base: '1rem', md: '1.5rem' }}
      margin={{ base: '0.5rem', md: '1rem' }}
      {...rest}
    >
      <HStack marginBottom={'0.5rem'}>
        <Heading size={'lg'} marginBottom={'0.5rem'}>
          {title}
        </Heading>
        <Spacer />
        <Button
          variant={'ghost'}
          leftIcon={<FiEdit />}
          onClick={isEditable ? onEditCancel : onEditEnter}
        >
          Edit
        </Button>
      </HStack>

      {children}

      {isEditable ? (
        <HStack marginTop={'0.5rem'}>
          <Spacer />
          <Button
            onClick={onEditSubmit}
            isDisabled={isFormInvalid ?? false}
            isLoading={isSubmitLoading ?? false}
            colorScheme={'blue'}
          >
            Save
          </Button>
        </HStack>
      ) : null}
    </Box>
  );
};

export default EditableFormCard;
