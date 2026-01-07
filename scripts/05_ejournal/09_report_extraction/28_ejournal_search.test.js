import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 電子ジャーナル検索
 * @memberof 電子ジャーナル検索.検索条件入力
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.ELECTRONIC_JOURNAL_SEARCH}
 * {@link TAGS.ENTER_SEARCH_CONDITIONS}
 * ### テスト観点
 * * 電子ジャーナル検索条件に一致した電子ジャーナルが抽出されること。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 電子ジャーナル検索 | `/ejournal/search` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * リクエストデータ:
 * * 2.ejournalを検索
 * * * 2.1 result_size:  0より大きい値
 * * * 2.2 from_datetime: 2022-06-21T00:00:00
 * * * 2.3 receipt_no: ステップ６でのデータ
 * * * 2.4 pos_condition
 * * * \+ is_all: false,
 * * * \+ pos_cd_list:["01"]
 * 
 * ---
 * ### 期待結果
 * * #### 5. 取引完了 `/sales/end`
 * * \- sales.receipt_no を取得する
 * * #### 6. 電子ジャーナル検索 `/ejournal/search`
 * * \- 検索結果件数が 0 より大きく、かつ result_size 以下であることを確認する
 * * * \+ journal_search_result_count > 0 and journal_search_result_count <= result_size
 * * \- すべてのjournals が step 6 で取得した取引（領収書番号）と一致することを確認する
 * * * \+ receipt_no = sales.receipt_no
 * * \- journal_data に 「通常商品」 情報が含まれていることを確認する
 */
export function TC_050928001_EjournalSearch() {
  group("TC_050928001 電子ジャーナル検索", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      ejournalSearch: CommonFunction.getFullDesc(ENDPOINT.EJOURNAL_SEARCH),
    };

    const resultSize = 10; //testdata

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    // Search using 5 primary keys: corporate_cd (get in header), store_cd (get in header), pos_cd, bussiness_day and receipt_no
    TestHelper.ejournalSearch(step.ejournalSearch, {
      resultSize,
      searchCondition: {
        from_datetime: salesBusinessDay,
        pos_condition: {
          is_all: false,
          pos_cd_list: [
            ENVIRONMENT.POS_CD,
          ],
        },
        receipt_no: salesReceiptNo,
      },
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the search result length is 1",
        expected: 1,
        actual: (res) => res.result?.journal_search_result_count,
      }),
      CHECK.createEqualsCheck({
        name: "Verify has journal match the sales transaction by receipt no",
        expected: true,
        actual: (res) => {
          const journal = res.result?.journals?.filter(q => q.receipt_no === salesReceiptNo);
          return journal !== null;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify journal data must contain information: 通常商品",
        expected: true,
        actual: (res) => {
          const journal = res.result?.journals?.find(q => q.receipt_no === salesReceiptNo);
          return journal?.journal_data?.includes(PROD.REGULAR);
        },
      }),
    ]);
  });
}
