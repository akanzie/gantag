import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 売掛による誤打訂正
 * @memberof 誤打訂正.売上業務
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CREDIT_SALE}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 掛売で支払った売上取引が誤打訂正により取消できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 掛売客情報検索 | `/accounts-receivable/search` |
 * | 5 | 掛売支払登録 | `/sales/cart/accounts-receivable` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 8 | 【誤打訂正】【掛売】掛売 | `/void/cart/accounts-receivable` |
 * | 9 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_074で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品 : 4500000000121
 * * 2. 観客情報
 * * \- 売掛顧客コード: 1000000012 (client_cd)
 * * \- 電話番号: 0252400711 (client_tel_no)
 * 
 * ---
 * ### 期待結果
 * *  * データ取得（売上取引 TC_074 にて確認済）
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo を取得する
 * * #### 5. 掛売支払登録 `/sales/cart/accounts-receivable`
 * * \- sales.payments[] を取得する
 * *  * 誤打訂正データが売上取引と一致することを確認
 * * #### 7.【誤打訂正】取引開始 `/void/begin`
 * * \- 売上取引と同じ金額であることを確認する
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8.【誤打訂正】掛売 `/void/cart/accounts-receivable`
 * * \- 返金金額が売上取引と同額であることを確認する
 * * * \+ void_payments に 売掛金 の支払い情報が含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返金後の残金が 0 であること
 * * * \+ total_balance_amount = 0
 * * #### 9.【誤打訂正】取引終了 `/void/end`
 * * \- レシートに以下の情報が含まれること:
 * *    「売掛金」「誤打訂正」
 * *    返金金額が売上取引と同額であること
 */
export function TC_040723001_VoidAccountsReceivablePayment() {
  group("TC_040723001 売掛による誤打訂正", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      searchAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.ACCOUNTS_RECEIVABLE_SEARCH),
      accountsReceivable: CommonFunction.getFullDesc(ENDPOINT.SALES_ACCOUNTS_RECEIVABLE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.VOID_ACCOUNTS_RECEIVABLE),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
    };

    const paidCode = PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_CODE;

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const clientInfos = TestHelper.searchAccountsReceivable(step.searchAccountsReceivable, {}, [
      CHECK.createStatusCodeCheck(),
    ]).result?.client_infos;

    const clientInfo = clientInfos?.find(c => c.client_tel_no === ENVIRONMENT.CLIENT_TEL_NO);
    const clientCd = clientInfo?.client_cd;

    const payments = TestHelper.salesAccountsReceivable(step.accountsReceivable, {
      cartNo,
      clientCd,
      paidAmount: salesCartInfo?.total_balance_amount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const accountsReceivablePayment = payments?.find(p => p.paid_cd === paidCode);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.cart_no;

    TestHelper.voidAccountsReceivable(step.voidAccountsReceivable, {
      cartNo,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: accountsReceivablePayment?.paid_cd,
          paidName: accountsReceivablePayment?.paid_name,
          paidAmount: accountsReceivablePayment?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === paidCode);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: 売掛金, 誤打訂正 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalBalanceAmount = CommonFunction.convertToCurrency(salesCartInfo?.total_balance_amount);
          return CommonFunction.includesItems([
            "売掛金",
            "誤打訂正",
            stringTotalBalanceAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
