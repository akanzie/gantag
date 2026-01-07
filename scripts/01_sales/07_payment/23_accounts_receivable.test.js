import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 売掛による支払
(Payment by accounts receivable)
 * @memberof 売上.支払
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.CUSTOMER_MANAGEMENT}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CREDIT_CUSTOMER}
 * {@link TAGS.CREDIT_SALE}
 * ### テスト観点
 * * 前提：
 * * * ・支払方法がm_pos_payment_patternに設定されている。
 * * * ・掛売を行う顧客が下記のマスタに設定されている。
 * * * m_accounts_receivable
 * * * m_accounts_receivable_attributes
 * * * ・テスト商品：通常商品。
 * * テスト観点：
 * * * ・事前に登録された顧客一覧から選択して掛売で支払い取引が完了できる。　
 * * * ・トラン保存の確認
 * * \- t_payment
 * * \- t_payment_accounts_receivable
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
 * | 7 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品 : 4500000000121
 * * 2.顧客情報: 
 * * \- 売掛顧客コード: 1000000012 (client_cd)
 * * \- 電話番号: 0252400711 (client_tel_no)
 * 
 * ---
 * ### 期待結果
 * * #### 2. 通常商品スキャン `/sales/cart/barcode`
 * * \- カート情報に通常商品が含まれていることを確認する：
 * * * \+ 通常商品 barcode: 4500000000121
 * * #### 3. 小計 `/sales/subtotal`
 * * * \+ total_balance_amount = items[0].unit_price + items[0].unit_price × (items[0].tax_rate / 100) = 400 + 400 × 8% = 432
 * * #### 5. 掛売支払登録 `/sales/cart/accounts-receivable`
 * * \- 合計金額が0になっていることを確認する。
 * * \- payments.length = 1 であることを確認する。
 * * \- 売掛金による支払が適用されていることを確認する：
 * * * \+ payments[0]:
 * * * * ・paid_cd: "0701"  
 * * * * ・paid_name: "売掛金"  
 * * * * ・paid_amount = 小計ステップ（3）のtotal_balance_amount  
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートに支払方法「売掛金」が含まれていることを確認する。
 * * #### 7. 売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- 取引が以下のテーブルに（receipt_noを基に）保存されていることを確認する：
 * * * \+ ms-sales.t_payment
 * * * \+ ms-sales.t_payment_accounts_receivable
 */
export function TC_010723001_AccountsReceivablePayments() {
  group("TC_010723001 売掛による支払", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      searchAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.ACCOUNTS_RECEIVABLE_SEARCH),
      accountsReceivable: CommonFunction.getFullDesc(ENDPOINT.SALES_ACCOUNTS_RECEIVABLE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {
      isSelf: false,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
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
      CHECK.createEqualsCheck({
        name: "Verify cart info has product 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    const clientCd = TestHelper.searchAccountsReceivable(step.searchAccountsReceivable, {}, [
      CHECK.createStatusCodeCheck(),
    ]).result?.client_infos?.[0]?.client_cd;

    TestHelper.salesAccountsReceivable(step.accountsReceivable, {
      cartNo,
      clientCd,
      paidAmount: totalBalanceAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify payment length",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.payments?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the payment by accounts receivable method has been applied",
        expected: {
          paidCd: PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_CODE,
          paidName: PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_NAME,
          paidAmount: totalBalanceAmount,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_CODE);
          return {
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt contain payment method 売掛金",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}
