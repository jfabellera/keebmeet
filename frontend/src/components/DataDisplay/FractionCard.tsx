import { type ReactNode } from 'react';
import {
  Box,
  Heading,
  HStack,
  Text,
  VStack,
  type BoxProps,
} from '@chakra-ui/react';

interface FractionCardProps extends BoxProps {
  numerator: number;
  denominator: number;
  label?: string;
}

const FractionCard = ({
  numerator,
  denominator,
  label,
  ...rest
}: FractionCardProps): ReactNode => {
  return (
    <Box
      background={'white'}
      borderRadius={'md'}
      boxShadow={'sm'}
      padding={'1rem'}
      {...rest}
    >
      <VStack spacing={0}>
        <HStack align={'baseline'} spacing={1}>
          <Heading size={'2xl'} fontWeight={'medium'}>
            {numerator}
          </Heading>
          <Text fontSize={'xl'}>/</Text>
          <Text fontSize={'xl'}>{denominator}</Text>
        </HStack>
        {label != null ? (
          <Text fontSize={'xs'}>{label.toUpperCase()}</Text>
        ) : null}
      </VStack>
    </Box>
  );
};

export default FractionCard;
