import { Spinner } from "../spinner/spinner";
import styles from "./page-loader.module.scss";

export function PageLoader() {
  return (
    <div className={styles.pageLoader}>
      <Spinner size={28} />
    </div>
  );
}
