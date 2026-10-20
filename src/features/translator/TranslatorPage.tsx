import { FlaskConical, Languages } from 'lucide-react';
import { LinkButton } from '../../ui/Button';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState } from '../../ui/States';

export function TranslatorPage() {
  return (
    <>
      <PageHeader title="Traductor" />
      <EmptyState
        icon={<Languages size={26} />}
        title="En desarrollo — próxima fase"
        action={
          <LinkButton to="/lab#traduccion" variant="secondary" icon={<FlaskConical size={18} />}>
            Ver las pruebas de OCR y traducción
          </LinkButton>
        }
      >
        El traductor de carteles y textos japoneses todavía no está disponible.
      </EmptyState>
    </>
  );
}
