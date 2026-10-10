// Hard-coded copy on purpose; test/no-hardcoded-copy.test.ts expects each line.
import { t } from '@/messages';

export function Bad() {
  return (
    <div>Tekst rett i JSX
      <button aria-label="Lukk" />
      <img alt="Logo" src="/x.png" />
      <input placeholder={'Søk'} />
      <span title={`Mer informasjon`} />
      {'Uttrykk i JSX'}
      <>{'Tekst i fragment'}</>
      <option label="Velg bransje" />
      <p>{t('shell.brand')}</p>
      <span className="figure" aria-hidden="true" />
    </div>
  );
}
