import Layout from "@/components/layout";
import { ComponentType } from "react";
import "../globals.css";
import NoSSR from "react-no-ssr";

type AppProps = {
  Component: ComponentType;
  pageProps: object;
};
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NoSSR>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </NoSSR>
  );
}
