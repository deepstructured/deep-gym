import styles from "./error-note.module.scss";

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className={styles.errorNote}>
      {message}
    </div>
  );
}
