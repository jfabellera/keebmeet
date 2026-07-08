import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components';
import type { ReactNode } from 'react';
import { emailTheme } from '../theme';

export interface EmailLayoutProps {
  /** Inbox preview text shown next to the subject line. */
  preview: string;
  children: ReactNode;
}

/**
 * Shared shell for every KeebMeet email: applies the brand Tailwind config
 * (see theme.ts) and a consistent card layout. Templates render their content
 * as children and use semantic classes like `bg-primary` / `text-foreground`.
 */
export const EmailLayout = ({ preview, children }: EmailLayoutProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Tailwind config={{ theme: { extend: emailTheme } }}>
      <Body className="bg-background font-sans">
        <Container className="mx-auto my-10 max-w-[480px] rounded-lg bg-card p-8">
          <Section className="mb-6 border-0 border-b border-solid border-border pb-4">
            <Heading className="m-0 text-[20px] font-bold tracking-tight text-primary">
              KeebMeet
            </Heading>
          </Section>
          {children}
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default EmailLayout;
